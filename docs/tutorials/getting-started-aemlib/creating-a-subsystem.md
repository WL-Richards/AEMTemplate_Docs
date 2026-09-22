---
sidebar_position: 2
title: Creating a Subsystem
---

# Creating a Subsystem

This guide adds a new single motor mechanism from nothing to a working button binding. The example is a climber: one Kraken X60 driving an arm that is measured in degrees and moved with Motion Magic. The hood in the library is built the same way, and every file below has a hood equivalent to compare against. Its reference pages are [Hood Configuration](../../reference/config/hood-configuration) and [Hood Subsystem](../../reference/subsystems/hood-subsystem).

A finished subsystem is made of the following pieces.

| Piece                        | Lives in                              | Purpose                                              |
| ---------------------------- | ------------------------------------- | ---------------------------------------------------- |
| Configuration class          | `lib/config/subsystems/climber`       | Describes the mechanism. Motor config, name, limits. |
| Inputs class                 | `lib/subsystems/climber`              | Sensor values beyond what the motor reports.         |
| IO interface                 | `lib/subsystems/climber/io`           | What the subsystem needs from hardware.              |
| Hardware, sim, and replay IO | `lib/subsystems/climber/io`           | The three implementations of that interface.         |
| Subsystem class              | `lib/subsystems/climber`              | Logic and commands.                                  |
| Robot config                 | `frcXXXX/config/robots`               | The numbers for one specific robot.                  |
| Factory method               | `frcXXXX/subsystems/SubsystemFactory` | Picks the IO for the current runtime mode.           |

The first five go in the library because a climber is not specific to one game. If the mechanism only makes sense for this season, put them under `frcXXXX/subsystems` instead. The turret is an example of that.

## The configuration class

Start with the configuration, since everything else is built from it. A subsystem configuration holds a name, a `MotorConfiguration`, and any mechanism specific values. It uses the same builder pattern as everything else in the library.

```java
package com.aembot.lib.config.subsystems.climber;

public class TalonFXClimberConfiguration {
  public final String kName;
  public final MotorConfiguration<TalonFXConfiguration> kMotorConfig;

  /** Angle the climber sits at when resting on its hard stop, in degrees */
  public double kRestingAngleDegrees = 0;

  public TalonFXClimberConfiguration(
      MotorConfiguration<TalonFXConfiguration> motorConfig, String name) {
    this.kMotorConfig = motorConfig;
    this.kName = name;
  }

  public TalonFXClimberConfiguration withRestingAngleDegrees(double degrees) {
    this.kRestingAngleDegrees = degrees;
    return this;
  }
}
```

Simulation needs one more thing, a `SimulatedMotorConfiguration` that carries the motor model. Rather than duplicating fields, the sim configuration extends the real one.

```java
package com.aembot.lib.config.subsystems.climber.simulation;

public class SimulatedClimberConfiguration extends TalonFXClimberConfiguration {
  public final SimulatedMotorConfiguration<TalonFXConfiguration> kSimMotorConfig;

  public SimulatedClimberConfiguration(
      SimulatedMotorConfiguration<TalonFXConfiguration> simMotorConfig, String name) {
    super(simMotorConfig.kRealConfiguration, name);
    this.kSimMotorConfig = simMotorConfig;
  }
}
```

The `TalonFX` prefix on the class name says which motor controller it is written for. If the mechanism were ever built with a different controller, that would be a second configuration class rather than a flag on this one.

## The inputs class

Inputs are the sensor values the subsystem reads every loop. For a mechanism that is just one motor, there are none beyond what the motor itself reports, and the motor's values are handled by `MotorInputs` in the base class. The class still has to exist so the IO interface has something to fill.

```java
package com.aembot.lib.subsystems.climber;

public class ClimberInputs implements LoggableInputs {
  @Override
  public void toLog(LogTable table) {}

  @Override
  public void fromLog(LogTable table) {}
}
```

If the climber had a limit switch or a distance sensor, its reading would be a public field here, written to the table in `toLog` and read back in `fromLog`. `HoodInputs` is empty for the same reason this one is.

```java
public class ClimberInputs implements LoggableInputs {
  public boolean atLimitSwitch = false;

  @Override
  public void toLog(LogTable table) {
    table.put("AtLimitSwitch", atLimitSwitch);
  }

  @Override
  public void fromLog(LogTable table) {
    atLimitSwitch = table.get("AtLimitSwitch", atLimitSwitch);
  }
}
```

:::info
AdvantageKit offers an `@AutoLog` annotation that generates `toLog` and `fromLog` for you. This codebase does not use it, and new inputs classes should not either. The annotation works by generating a separate subclass, `ClimberInputsAutoLogged`, and that is the type you would have to use everywhere. It does not fit with how the library's base classes are written. `MotorSubsystem` is generic over `I extends MotorInputs`, and subsystems pass inputs types up through `super(...)` calls, which gets awkward when the real type is a generated one. Writing the two methods by hand is a few lines per field, keeps the log key names explicit, and means the class you declare is the class you use.
:::

## The IO interface

The interface says what the subsystem needs from hardware. For a motor driven mechanism that is two things: the motor, and a way to fill the inputs.

```java
package com.aembot.lib.subsystems.climber.io;

public interface ClimberIO extends Loggable {
  /** The motor this IO drives */
  public MotorIO getMotor();

  /** Fill in the inputs from hardware */
  public void updateInputs(ClimberInputs inputs);
}
```

[`MotorIO`](../../reference/core/motor-io) is the library's interface for a single motor. It has methods for every control request the TalonFX supports, and the subsystem base class drives the motor through it. Returning it from the IO means the subsystem never touches a `TalonFX` directly.

[`Loggable`](../../reference/logging/loggers) adds an `updateLog` method that the subsystem calls once per loop, so each IO can log anything it wants under the subsystem's prefix.

## The hardware IO

The hardware IO creates a real `MotorIOTalonFX` from the motor configuration and hands it back.

```java
package com.aembot.lib.subsystems.climber.io;

public class TalonFXClimberHardwareIO implements ClimberIO {
  private final MotorIOTalonFX motor;

  public TalonFXClimberHardwareIO(TalonFXClimberConfiguration config) {
    this.motor = new MotorIOTalonFX(config.kMotorConfig);
  }

  @Override
  public MotorIO getMotor() {
    return motor;
  }

  @Override
  public void updateInputs(ClimberInputs inputs) {}

  @Override
  public void updateLog(String standardPrefix, String inputPrefix) {}
}
```

One line does all the work. `new MotorIOTalonFX(config)` calls `TalonFXFactory.createRawWithConfig` under the hood, which is where the library turns a configuration into a live motor controller. The factory does the following, in order. The [TalonFX Factory](../../reference/core/talonfx-factory) reference covers every method on it.

1. Creates a `TalonFX` on the CAN ID and bus named in the configuration's `CANDeviceID`.
2. Clears sticky faults, so errors from before this boot do not carry over.
3. Writes the `TalonFXConfiguration` to the device. The write is retried until the device acknowledges it, because a config that silently fails to apply is one of the worst bugs to track down.
4. Points the `CANDeviceID` at the motor's supply voltage signal at 100 Hz. That signal arriving is how the library decides the device is connected.
5. Registers the device with `CANStatusLogger` for its bus, so connection state shows up in the log.

`MotorIOTalonFX` then sets up the six status signals it reads every loop, position, velocity, voltage, both currents, and rotor position, at 50 Hz to match the robot loop. Everything else the device could stream is turned off to keep the bus quiet.

:::info
`TalonFXFactory.createIO(config)` does the same thing as `new MotorIOTalonFX(config)`. The flywheel uses one and the hood uses the other. Either is fine.
:::

## The simulation IO

The sim IO creates a `MotorIOTalonFXSim` instead. It is a subclass of `MotorIOTalonFX`, so the subsystem drives it identically, but its sensor readings come from a physics model rather than a real motor. The model has to be stepped forward in time, and a `Notifier` does that on a background thread every 5 milliseconds.

```java
package com.aembot.lib.subsystems.climber.io;

public class ClimberSimIO implements ClimberIO {
  private final MotorIOTalonFXSim simMotor;
  private final Notifier simNotifier;

  public ClimberSimIO(SimulatedClimberConfiguration config) {
    this.simMotor = new MotorIOTalonFXSim(config.kSimMotorConfig);
    this.simNotifier = new Notifier(() -> simMotor.updateSimState());
    simNotifier.setName(config.kName + "Notifier");
    simNotifier.startPeriodic(0.005);
  }

  @Override
  public MotorIO getMotor() {
    return simMotor;
  }

  @Override
  public void updateInputs(ClimberInputs inputs) {}

  @Override
  public void updateLog(String standardPrefix, String inputPrefix) {
    simMotor.logSim(standardPrefix, inputPrefix);
  }
}
```

The sim motor models a plain rotating load using the moment of inertia from the motor configuration. That is good enough for a flywheel or a low mass arm, and it is what every sim IO in the library uses today. A mechanism that gravity acts on noticeably would need a different physics model, such as WPILib's `SingleJointedArmSim`, and the library does not currently offer a way to swap one in. Doing so would be a change to `MotorIOTalonFXSim`.

## The replay IO

Replay needs an IO that does nothing, because AdvantageKit fills in the inputs from the log file.

```java
package com.aembot.lib.subsystems.climber.io;

public class ClimberIOReplay implements ClimberIO {
  @Override
  public MotorIO getMotor() {
    return new MotorIOReplay();
  }

  @Override
  public void updateInputs(ClimberInputs inputs) {}

  @Override
  public void updateLog(String standardPrefix, String inputPrefix) {}
}
```

[`MotorIOReplay`](../../reference/core/motor-io#motorioreplay) is the library's empty motor. Every setter is a no-op and every status check reports success, so the subsystem runs its logic without complaint while AdvantageKit supplies the inputs.

## The subsystem

With the IO in place, the subsystem is short. It extends [`MotorSubsystem`](../../reference/subsystems/motor-subsystem), which provides the periodic loop, logging of `MotorInputs`, encoder offset handling, and a command for every kind of motor control. The three type parameters are the inputs type, the IO type, and the configuration type.

```java
package com.aembot.lib.subsystems.climber;

public class ClimberSubsystem
    extends MotorSubsystem<MotorInputs, MotorIO, MotorConfiguration<TalonFXConfiguration>> {

  private final ClimberIO io;
  private final TalonFXClimberConfiguration config;

  public ClimberSubsystem(TalonFXClimberConfiguration config, ClimberIO io) {
    super(config.kName, new MotorInputs(), io.getMotor(), config.kMotorConfig);
    this.io = io;
    this.config = config;

    // The climber boots resting on its hard stop, so tell the encoder where that is.
    // This takes degrees. The IO converts to rotor rotations before touching the device.
    this.setEncoderPosition(config.kRestingAngleDegrees);
  }

  @Override
  public void updateLog(String standardPrefix, String inputPrefix) {
    io.updateLog(standardPrefix, inputPrefix);
    super.updateLog(standardPrefix, inputPrefix);
  }

  /** Move to an angle in degrees using Motion Magic */
  public Command goToAngleCommand(double degrees) {
    return smartPositionSetpointCommand(() -> degrees).withName("ClimberGoTo" + degrees);
  }
}
```

The `super(...)` call passes the name, a fresh `MotorInputs`, the motor from the IO, and the motor configuration up to the base class. This is what it runs.

```java
// MotorSubsystem
public MotorSubsystem(String name, I motorInputs, M motor, C motorConfiguration) {
  super(name); // AEMSubsystem: stores the name and builds the log prefixes from it
  this.motorConfig = motorConfiguration;
  this.inputs = motorInputs;
  this.io = motor;

  setDefaultCommand(
      dutyCycleCommand(() -> 0.0) // sit still whenever nothing else is running
          .withName("DefaultNeutral")
          .ignoringDisable(true)); // even while the robot is disabled
}
```

Three things come out of that. The `io`, `inputs`, and `motorConfig` fields are now set, and every command the base class provides drives through them. The subsystem has a name and a pair of log prefixes derived from it, `Subsystems/ClimberSubsystem` and `Inputs/Subsystems/ClimberSubsystem`. And the climber already has a default command, so it will hold zero output the moment the scheduler starts, before any binding has been written.

From that point the base class owns the motor. `periodic()` does not need to be overridden for a mechanism this simple, because the base version already reads the motor inputs and calls `updateLog`.

`smartPositionSetpointCommand` is one of the commands the base class provides. "Smart" is the library's word for Motion Magic. The full set is on the [Motor Subsystem](../../reference/subsystems/motor-subsystem#commands) reference page, and covers duty cycle, voltage, PID position and velocity, and Motion Magic position and velocity. Wrapping one in `goToAngleCommand` gives the climber a method with a name that means something at the binding site.

:::tip
Start by adding nothing beyond the constructor. Deploy, drive the mechanism with the base class commands from a temporary binding, and confirm the direction and units are right. Add climber specific behavior only once the motor is proven.
:::

## The robot configuration

The library classes above take numbers. The numbers for a specific robot live in a helper under `frcXXXX/config/robots`, following the same layout as `ProductionDrivetrainConfig` in the template or `ProductionHoodConfig` in the [2026 season code](https://github.com/AEMBOT/FRC_2026).

```java
package com.aembot.frcXXXX.config.robots;

public class ProductionClimberConfig {
  public final String SUBSYSTEM_NAME = "ClimberSubsystem";

  // Motor rotations per one rotation of the arm. 100 means the motor turns 100 times
  // for the arm to turn once. Comes from the gearbox stages, so get it from CAD, not by eye.
  public final double GEAR_RATIO = 100;

  public final double RESTING_ANGLE_DEGREES = 0;
  public final double MAX_ANGLE_DEGREES = 110;

  public final MotorConfiguration<TalonFXConfiguration> MOTOR_CONFIG =
      new MotorConfiguration<TalonFXConfiguration>()
          .withMotorConfig(
              new TalonFXConfiguration()
                  .withMotorOutput(
                      new MotorOutputConfigs()
                          // Hold position when output is zero, so the arm does not drop
                          .withNeutralMode(NeutralModeValue.Brake)
                          // Which shaft direction counts as positive. Pick whichever makes
                          // the arm angle increase as it rises, viewed from the motor's face.
                          .withInverted(InvertedValue.Clockwise_Positive))
                  // Cap current drawn from the battery at 40 A. Protects the breaker and keeps
                  // a stalled arm from browning out the robot. Current limits are enabled by
                  // default in Phoenix 6, so setting the value is enough.
                  .withCurrentLimits(new CurrentLimitsConfigs().withSupplyCurrentLimit(40))
                  // Closed loop gains, in order: kP, kI, kD, kG, kS, kV, kA. Only kS and kV are
                  // set here. kS is the voltage needed to overcome friction and start moving,
                  // kV is volts per rotor rotation per second. Add kP once the feedforward is
                  // close, and kG if gravity pulls the arm down noticeably.
                  .withSlot0(new ConfigureSlot0Gains(0.0, 0.0, 0.0, 0.0, 0.4, 0.12, 0.0))
                  // Motion Magic moves to a target along a trapezoid profile: ramp up at the
                  // acceleration, hold the cruise velocity, ramp down to stop on target. Cruise
                  // velocity is in rotor rotations per second and acceleration in rotor rotations
                  // per second squared, so the arm values in degrees are converted to arm
                  // rotations and then multiplied by the gear ratio.
                  .withMotionMagic(
                      new MotionMagicConfigs()
                          // Top speed: 180 degrees of arm per second
                          .withMotionMagicCruiseVelocity(Units.degreesToRotations(180) * GEAR_RATIO)
                          // Acceleration: 360 degrees per second, per second. At that rate the
                          // arm goes from stopped to the 180 deg/s cruise speed in half a second.
                          .withMotionMagicAcceleration(Units.degreesToRotations(360) * GEAR_RATIO)))
          // Which physical device this is (see the CANDeviceID reference). In order: the CAN ID set on the motor in Phoenix
          // Tuner, a name for logs, the subsystem it belongs to, and the device type. No bus is
          // given, so it defaults to "rio". Pass a bus name as a fifth argument for a CANivore.
          .withCANDevice(
              new CANDeviceID(
                  60, SUBSYSTEM_NAME + "Motor", SUBSYSTEM_NAME, CANDeviceType.TALON_FX))
          .withName(SUBSYSTEM_NAME + "Motor")
          // Degrees of arm travel per one rotor rotation. One rotor turn is 1/GEAR_RATIO of an
          // arm turn, and an arm turn is 360 degrees, so this is 360 / GEAR_RATIO.
          .withUnitToRotorRotationRatio(Units.rotationsToDegrees(1 / GEAR_RATIO))
          .withMinPositionUnits(RESTING_ANGLE_DEGREES)
          .withMaxPositionUnits(MAX_ANGLE_DEGREES);

  public final SimulatedMotorConfiguration<TalonFXConfiguration> SIM_MOTOR_CONFIG =
      new SimulatedMotorConfiguration<TalonFXConfiguration>()
          .withRealConfiguration(MOTOR_CONFIG)
          .withStartingRotation(RESTING_ANGLE_DEGREES)
          .withSimMotorConstants(DCMotor.getKrakenX60(1));

  public final TalonFXClimberConfiguration CONFIG =
      new TalonFXClimberConfiguration(MOTOR_CONFIG, SUBSYSTEM_NAME)
          .withRestingAngleDegrees(RESTING_ANGLE_DEGREES);

  public final SimulatedClimberConfiguration SIM_CONFIG =
      new SimulatedClimberConfiguration(SIM_MOTOR_CONFIG, SUBSYSTEM_NAME);
}
```

Two of these lines deserve attention. The unit ratio, `Units.rotationsToDegrees(1 / GEAR_RATIO)`, is the number of degrees the arm moves per rotation of the motor shaft. Getting it wrong means every position is off by a constant factor, which is easy to spot on the first test. The Motion Magic values are in rotor rotations per second, so a cruise velocity given in degrees has to be converted the other way, which is why it is multiplied by the gear ratio.

Then add the getters to `RobotConfiguration` and implement them in `ProductionConfig`, as described in [Creating a Robot Definition](./creating-a-robot-definition).

```java
// In RobotConfiguration
public abstract TalonFXClimberConfiguration getClimberConfig();
public abstract SimulatedClimberConfiguration getSimClimberConfig();

// In ProductionConfig
private static final ProductionClimberConfig CLIMBER_CONFIG = new ProductionClimberConfig();

@Override
public TalonFXClimberConfiguration getClimberConfig() {
  return CLIMBER_CONFIG.CONFIG;
}

@Override
public SimulatedClimberConfiguration getSimClimberConfig() {
  return CLIMBER_CONFIG.SIM_CONFIG;
}
```

## The factory method

`SubsystemFactory` is where the runtime mode picks an IO. Add one method following the pattern of the ones already there.

```java
public static ClimberSubsystem createClimberSubsystem() {
  switch (RobotRuntimeConstants.MODE) {
    case SIM:
      return new ClimberSubsystem(
          RobotRuntimeConstants.ROBOT_CONFIG.getSimClimberConfig(),
          new ClimberSimIO(RobotRuntimeConstants.ROBOT_CONFIG.getSimClimberConfig()));
    case REPLAY:
      return new ClimberSubsystem(
          RobotRuntimeConstants.ROBOT_CONFIG.getClimberConfig(),
          new ClimberIOReplay());
    case REAL:
    default:
      return new ClimberSubsystem(
          RobotRuntimeConstants.ROBOT_CONFIG.getClimberConfig(),
          new TalonFXClimberHardwareIO(RobotRuntimeConstants.ROBOT_CONFIG.getClimberConfig()));
  }
}
```

## Wiring it up

Finally, create it in `RobotContainer` and give it something to do.

```java
private final ClimberSubsystem climberSubsystem = SubsystemFactory.createClimberSubsystem();

// In configureBindings()
driverController.povUp().onTrue(climberSubsystem.goToAngleCommand(110));
driverController.povDown().onTrue(climberSubsystem.goToAngleCommand(0));
```

`MotorSubsystem` sets a default command of zero output in its constructor, so nothing else is needed for the climber to sit still when no button is held. Run the simulator, and the climber should show up under `Subsystems/ClimberSubsystem` and `Inputs/Subsystems/ClimberSubsystem` in AdvantageScope with its position tracking the commanded angle.

Once it works, move the button bindings into a command factory as described on the [Command-Based Programming](../getting-started-frc/command-based-programming#command-factories) page.
