---
sidebar_position: 3
title: IO Layers and Logging
---

# IO Layers and Logging

The codebase is built on [AdvantageKit](https://docs.advantagekit.org), a logging framework that records every input to the robot code so that a match can be replayed on a laptop with the exact same values the robot saw. That only works if hardware access is kept strictly separate from robot logic, which is why every subsystem here is split into three layers.

This page describes how the pattern is applied in this repo. The AdvantageKit page on [recording inputs](https://docs.advantagekit.org/data-flow/recording-inputs/) explains the underlying mechanism and is worth reading alongside it.

## The three layers

**The subsystem** holds the logic. It decides what the mechanism should do and exposes commands. It never talks to a motor controller directly.

**The inputs class** is a plain data object with one public field per sensor value. [`MotorInputs`](../../reference/core/motor-io#motorinputs) has fields for position, velocity, applied voltage, and current. It is the only thing that crosses from hardware into logic.

**The IO interface** has one job: fill in the inputs. It declares an `updateInputs(inputs)` method and whatever setters the subsystem needs to command the hardware. There is one implementation per environment.

| Implementation  | Used when              | Talks to                                |
| --------------- | ---------------------- | --------------------------------------- |
| `...HardwareIO` | Running on the roboRIO | Real motor controllers and sensors      |
| `...SimIO`      | Running in simulation  | A physics model of the mechanism        |
| `...ReplayIO`   | Replaying a log        | Nothing. Inputs come from the log file. |

```java
public interface FlywheelIO extends Loggable {
  public void updateInputs(FlywheelInputs inputs); // every IO interface has this

  public MotorIO getMotor(); // only IOs for motor driven mechanisms have this
}
```

`updateInputs` is not enforced by any base type, but every IO interface in the codebase declares it, and the subsystem calls it at the top of every loop. Treat it as required. An IO without it has no way to get sensor data into the inputs object, and therefore into the log.

`getMotor` exists because of how the subsystem base class works. [`MotorSubsystem`](../../reference/subsystems/motor-subsystem) drives its motor through a [`MotorIO`](../../reference/core/motor-io), which is the library's interface for a single motor controller. Which `MotorIO` that is depends on the environment: a real TalonFX, a simulated one, or the empty replay motor. The mechanism's IO is the layer that knows the environment, so it is the one that constructs the motor and hands it up through `getMotor`. The subsystem receives a `MotorIO` and never learns which kind it got.

IOs for mechanisms that are not a single motor look different. The drivetrain IO has no `getMotor` because it manages four modules, and the vision IO has none because there is no motor at all. The shape of the interface follows the hardware.

The subsystem is constructed with one of these and does not know which. A factory picks the right one for the environment at startup, and the [Creating a Subsystem](../getting-started-aemlib/creating-a-subsystem#the-factory-method) page shows how that choice is made.

:::warning
As shipped, the runtime mode is only ever `REAL` or `SIM`. It is derived from whether the code is on a roboRIO, and nothing sets `REPLAY`. To replay a log today, temporarily change `MODE` in `RuntimeConstants` to `RuntimeMode.REPLAY`, run the simulator, and change it back before committing. The replay IO classes and the replay branch of the logger setup are all in place and work once the mode is set.
:::

:::info
The replay implementation is usually empty. Its `updateInputs` does nothing, because AdvantageKit overwrites the inputs object with logged values right after the call.
:::

## The loop

Every subsystem's `periodic()` starts the same way: ask the IO to fill the inputs, then hand them to AdvantageKit. In the library that pair lives in `MotorSubsystem`, so a mechanism gets it by calling `super.periodic()`.

```java
// MotorSubsystem
@Override
public void periodic() {
  io.updateInputs(inputs); // IO fills the inputs from hardware, sim, or nothing
  updateLog();             // Logger.processInputs runs in here
}
```

The first line asks the IO layer to fill the inputs from whatever hardware exists. The second hands them to AdvantageKit through `Logger.processInputs`. On the robot, that writes the values to the log. In replay, it replaces them with values read from the log. Everything that runs after it sees identical data either way. The details of what `processInputs` does with the object are covered in the AdvantageKit [recording inputs](https://docs.advantagekit.org/data-flow/recording-inputs/) page.

A real mechanism usually has more to do after that. The hood's `periodic()` is a typical example.

```java
// HoodSubsystem
@Override
public void periodic() {
  double timestamp = Timer.getFPGATimestamp(); // note when this loop started

  super.periodic(); // inputs are now filled and logged

  // Everything below runs on logged data, so it behaves identically in replay
  state.updateHoodAngle(new Rotation2d(Units.degreesToRadians(inputs.positionUnits)));

  motorEnabled = SmartDashboard.getBoolean("Hood Enabled", true);

  AEMLogger.recordOutput(
      logPrefixStandard + "/LatencyPeriodicMS", (Timer.getFPGATimestamp() - timestamp) * 1000);
}
```

The order matters. `super.periodic()` goes first so that `inputs` holds this loop's values before anything reads them. The hood then pushes its angle into the shared robot state, reads a dashboard toggle, and finally logs how long the whole loop took. None of that touches hardware. All of it works from `inputs`, which is why it replays correctly.

:::warning
The dashboard read breaks the rule. A plain `SmartDashboard.getBoolean` is not an input AdvantageKit knows about, so in replay it returns the default value instead of what the operator actually set. For a debug toggle that only disables a motor it is harmless, but anything that affects behavior should use AdvantageKit's `LoggedNetworkBoolean` instead, which logs the value as an input and replays it correctly.
:::

This is why logic must never read hardware directly. A call to `motor.getPosition()` from inside a command would return a live value on the robot and garbage in replay, and the replay would diverge from what actually happened.

## Outputs

Inputs are logged automatically. Anything the code computes is not, and has to be logged by hand with `Logger.recordOutput`, or with the library's [`AEMLogger`](../../reference/logging/loggers) wrapper which most subsystem code uses.

```java
Logger.recordOutput("Flywheel/Setpoint", currentVelocitySetpoint);
Logger.recordOutput("Flywheel/AtSpeed", atSpeed());
```

Outputs are recorded in replay as well, which is the point. Change the logic, replay the log, and see what the new code would have done with the old inputs.

:::tip
Log generously. A value that is logged and never looked at costs almost nothing. A value that is not logged cannot be recovered after the match.
:::

## What gets logged

On the robot, AdvantageKit writes logs to a USB stick at `/U/logs`. When not connected to the field, it also streams the same data over NetworkTables so AdvantageScope can show it live. On the field, only the file is written. In replay, the outputs are saved to a copy of the original log with `_sim` added to the name, so the original is never touched.

All of that is set up in one place, `setupLogger` in `lib/core/logging/Loggerable.java`, which is documented on the [Logging](../../reference/logging/loggers) reference page. It is an interface with a default method that switches on the runtime mode, adds the right data receivers for each case, records the build metadata, and calls `Logger.start()`. `RobotContainer` implements the interface and calls `setupLogger` in its constructor, so it runs once at boot before any subsystem exists.

```java
switch (MODE) {
  case REAL:
    Logger.addDataReceiver(new WPILOGWriter("/U/logs")); // file on the USB stick
    if (!DriverStation.isFMSAttached()) {
      Logger.addDataReceiver(new NT4Publisher()); // live stream, but not on the field
    }
    break;
  case SIM:
    Logger.addDataReceiver(new WPILOGWriter()); // file in the project's logs folder
    Logger.addDataReceiver(new NT4Publisher());
    break;
  case REPLAY:
    robot.setUseTiming(false); // run as fast as possible, not in real time
    String logPath = LogFileUtil.findReplayLog();
    Logger.setReplaySource(new WPILOGReader(logPath));
    Logger.addDataReceiver(new WPILOGWriter(LogFileUtil.addPathSuffix(logPath, "_sim")));
    break;
}
```

To change where logs go or add another destination, this is the only file to touch.

- Every inputs object, once per loop, under the subsystem's name.
- Every `recordOutput` call.
- Driver Station state: enabled, alliance, match time, joystick values.
- Scheduler activity: which commands started and ended and when.
- System stats: CAN utilization, loop time, battery voltage.

Logs are opened in AdvantageScope. The `Metadata` tab shows the git commit, branch, and build date the robot was running, and whether there were uncommitted changes. Check it before anything else when a log looks wrong.

## Reading the naming

Class names in the codebase follow the layer they belong to. Given a mechanism called `Hood`, expect to find the following.

| Class                   | Layer                                                   |
| ----------------------- | ------------------------------------------------------- |
| `HoodSubsystem`         | Logic and commands                                      |
| `HoodInputs`            | Sensor values                                           |
| `HoodIO`                | Interface                                               |
| `TalonFXHoodHardwareIO` | Real hardware, named for the motor controller it drives |
| `HoodSimIO`             | Simulation                                              |
| `HoodIOReplay`          | Replay                                                  |

Older classes are not consistent about whether `IO` comes before or after `Replay`. Both spellings exist. New code should follow whichever pattern the neighboring classes use.
