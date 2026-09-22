---
sidebar_position: 3
title: Motor IO
---

# Motor IO

`MotorIO` is the library's interface for a single motor controller. It is the boundary between subsystem logic and hardware: `MotorSubsystem` drives its motor through this interface and never touches a `TalonFX` directly. There is one implementation for real hardware, two for simulation, and one for replay.

```java
import com.aembot.lib.core.motors.interfaces.MotorIO;
```

Every position and velocity argument is in the mechanism units defined by the motor's `MotorConfiguration`. Implementations convert to rotor rotations internally. Every method that talks to hardware returns `true` on success and `false` on failure.

## Enums

Two nested enums translate between library terms and CTRE's.

| Enum              | Values           | Meaning                                           |
| ----------------- | ---------------- | ------------------------------------------------- |
| `NeutralMode`     | `COAST`, `BRAKE` | What the motor does at zero output.               |
| `FollowDirection` | `SAME`, `INVERT` | Whether a follower mirrors or opposes its leader. |

Each has a `toCTRE...()` instance method and a static `fromCTRE...()` for converting to and from the Phoenix 6 equivalents, `NeutralModeValue` and `MotorAlignmentValue`.

## Methods

### Identity and inputs

| Method                             | Description                                                                |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `getName()`                        | The motor's name for logging.                                              |
| `updateInputs(MotorInputs inputs)` | Fill `inputs` from the hardware. Called once per loop by `MotorSubsystem`. |
| `hasResetOccurred()`               | `true` the first time it is called after the device has reset.             |

### Control

| Method                                                                                                                                   | Control mode                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setOpenLoopDutyCycle(double dutyCycle)`                                                                                                 | Fraction of supply voltage, -1 to 1. Open loop.                                                                                                                                                      |
| `setVoltageOutput(double volts)`                                                                                                         | Fixed voltage. Open loop.                                                                                                                                                                            |
| `setTorqueCurrent(double current)`                                                                                                       | Fixed stator current in amps. Open loop.                                                                                                                                                             |
| `setPIDPositionSetpoint(double positionUnits, int slot)`                                                                                 | Position, plain PID on the device.                                                                                                                                                                   |
| `setPIDVelocitySetpoint(double velocityUnitsPerSecond, int slot)`                                                                        | Velocity, plain PID on the device.                                                                                                                                                                   |
| `setSmartPositionSetpoint(double positionUnits, int slot)`                                                                               | Position with Motion Magic.                                                                                                                                                                          |
| `setSmartPositionSetpoint(double positionUnits)`                                                                                         | Same, slot 0. Default method.                                                                                                                                                                        |
| `setSmartVelocitySetpoint(double unitsPerSecond, int slot)`                                                                              | Velocity with Motion Magic.                                                                                                                                                                          |
| `setSmartVelocitySetpoint(double unitsPerSecond)`                                                                                        | Same, slot 0. Default method.                                                                                                                                                                        |
| `setDynamicSmartPositionSetpoint(double positionUnits, double velocity, double acceleration, double jerk, double feedforward, int slot)` | Motion Magic position with the profile limits given per call. Velocity, acceleration, and jerk are in rotor rotations per second, per second squared, and per second cubed. Feedforward is in volts. |
| `setDynamicSmartPositionSetpoint(double positionUnits, double velocity, double acceleration, double jerk, double feedforward)`           | Same, slot 0. Default method.                                                                                                                                                                        |
| `follow(CANDeviceID masterDevice, FollowDirection direction)`                                                                            | Mirror another motor.                                                                                                                                                                                |

"Smart" is the library's word for Motion Magic. The `slot` argument selects which of the device's gain banks to use, and is almost always 0.

### Encoder

| Method                                       | Description                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `setCurrentEncoderPosition(double position)` | Tell the encoder that its current physical position is `position`, in mechanism units. |
| `zeroEncoderPosition()`                      | `setCurrentEncoderPosition(0.0)`. Default method.                                      |

:::info
The TalonFX's built in encoder is relative. Setting its position changes what the current location is called. It does not move anything, and it is forgotten on power cycle. Mechanisms that need to know where they are at boot either sit on a hard stop and set the encoder to that angle, or use a CANcoder.
:::

### Configuration

| Method                                                      | Description                                                                                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setNeutralMode(NeutralMode mode)`                          | Change coast or brake and reapply the config.                                                                                                      |
| `setEnableSoftwareLimits(boolean forward, boolean reverse)` | Turn the soft limits on or off and reapply.                                                                                                        |
| `getEnableSoftwareLimits()`                                 | A `Pair<Boolean, Boolean>` of forward and reverse enabled state.                                                                                   |
| `setEnableHardwareLimits(boolean forward, boolean reverse)` | Turn limit switch inputs on or off and reapply.                                                                                                    |
| `getEnableHardwareLimits()`                                 | A `Pair<Boolean, Boolean>` of forward and reverse enabled state.                                                                                   |
| `setZeroOnHardwareLimits(boolean forward, boolean reverse)` | Auto-zero the encoder when a limit switch is hit. Enabling this also enables the matching hardware limit. Disabling it does not disable the limit. |
| `getZeroOnHardwareLimits()`                                 | A `Pair<Boolean, Boolean>` of forward and reverse enabled state.                                                                                   |
| `setSmartMotorConfig(MotionMagicConfigs config)`            | Replace the Motion Magic limits and reapply.                                                                                                       |
| `setVoltageConfig(VoltageConfigs config)`                   | Replace the voltage config. Applied non-blocking.                                                                                                  |

These write to the device, and each one takes time on the CAN bus. They are for one-off changes like toggling brake mode from a dashboard, not for use inside a command's `execute`.

## MotorInputs

`MotorInputs` is the data object `updateInputs` fills. It is what `MotorSubsystem` logs every loop under `Inputs/Subsystems/<name>/Inputs`.

```java
import com.aembot.lib.core.motors.MotorInputs;
```

| Field                    | Units               | Source                             |
| ------------------------ | ------------------- | ---------------------------------- |
| `positionUnits`          | Mechanism units     | Position signal, converted         |
| `velocityUnitsPerSecond` | Mechanism units / s | Velocity signal, converted         |
| `appliedVolts`           | Volts               | Motor voltage signal               |
| `currentStatorAmps`      | Amps                | Stator current signal              |
| `currentSupplyAmps`      | Amps                | Supply current signal              |
| `rawRotorPosition`       | Rotor rotations     | Rotor position signal, unconverted |

All fields default to `0.0`. The class implements `LoggableInputs` by hand rather than with `@AutoLog`, so the log keys are written out explicitly in `toLog` and `fromLog`.

:::warning
`fromLog` reads the position field back under the key `UnitPosition`, but `toLog` writes it as `PositionUnits`. In replay, `positionUnits` is never restored from the log and stays at its default. This is a bug in `MotorInputs.java`.
:::

## MotorIOTalonFX

The real implementation. Wraps a Phoenix 6 `TalonFX` and a `MotorConfiguration`, and implements `CANable` so its `CANDeviceID` can be read back.

```java
import com.aembot.lib.core.motors.io.MotorIOTalonFX;
```

### Constructors

| Constructor                                                       | Notes                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `MotorIOTalonFX(MotorConfiguration<TalonFXConfiguration> config)` | The usual one. Creates the motor through `TalonFXFactory.createRawWithConfig`. |
| `MotorIOTalonFX(CANDeviceID device, TalonFXConfiguration config)` | Builds a `MotorConfiguration` with default ratios and calls the above.         |
| `MotorIOTalonFX(TalonFX motor)`                                   | Wraps an existing motor. Leaves the `MotorConfiguration` null.                 |

The third constructor exists for the drivetrain, where CTRE creates the motors. With a null configuration, any method that needs unit conversion or the CAN device throws a `NullPointerException` with a message explaining why. The methods that still work are the raw control requests that take rotor rotations directly, `updateInputs` is not among them.

### Status signals

The constructor subscribes to six signals and stores them in an array so they can be refreshed in one call.

| Signal         | Feeds                    |
| -------------- | ------------------------ |
| Position       | `positionUnits`          |
| Velocity       | `velocityUnitsPerSecond` |
| Motor voltage  | `appliedVolts`           |
| Stator current | `currentStatorAmps`      |
| Supply current | `currentSupplyAmps`      |
| Rotor position | `rawRotorPosition`       |

All six are set to update at 50 Hz to match the robot loop, then `optimizeBusUtilization` is called on the device, which disables every other signal the device could stream. A device created this way sends only what the library reads plus the supply voltage signal that `TalonFXFactory` added for connection tracking.

`updateInputs` calls `BaseStatusSignal.refreshAll` on the array, copies each value into the inputs object with unit conversion where needed, and logs the device's current control mode as `<name>_control`. It returns `true` only if the refresh status was `OK`.

### Behavior notes

- Position setpoints are clamped to `kMinPositionUnits` and `kMaxPositionUnits` from the configuration before being converted and sent. Velocity setpoints are not clamped.
- Every configuration setter mutates the stored `TalonFXConfiguration` and reapplies it with retries through `CTREUtil`. `setVoltageConfig` is the exception and applies non-blocking with a 10 ms timeout.
- `follow` records the master on this device's `CANDeviceID` before sending the follower request.
- `getTalon()` returns the wrapped `TalonFX` for the rare case that needs it.

## MotorIOTalonFXSim

Extends `MotorIOTalonFX` and drives its Phoenix 6 sim state from a WPILib `DCMotorSim`. The subsystem sees an ordinary `MotorIOTalonFX`. The difference is where the sensor values come from.

```java
import com.aembot.lib.core.motors.io.MotorIOTalonFXSim;
```

### Constructors

| Constructor                                                                   | Sim model                             |
| ----------------------------------------------------------------------------- | ------------------------------------- |
| `MotorIOTalonFXSim(SimulatedMotorConfiguration<TalonFXConfiguration> config)` | Built from the config. The usual one. |
| `MotorIOTalonFXSim(CANDeviceID device, TalonFXConfiguration config)`          | Built with default ratios.            |
| `MotorIOTalonFXSim(TalonFX motor)`                                            | None. For the drivetrain only.        |

The model is a `DCMotorSim` built from the `DCMotor` constants, moment of inertia, and gear ratio in the configuration. The starting angle comes from `kStartingRotationUnits`. Position is clamped to the configuration's min and max, and velocity is zeroed when the model hits either limit, so a simulated arm stops at its hard stops instead of spinning through them. The motor's inversion setting is applied to the sim state's orientation so positive direction matches the real motor.

### Methods

| Method                                              | Description                                                                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `updateSimState()`                                  | Step the physics model forward by the elapsed time and push the result into the TalonFX sim state. Must be called on a timer, usually every 5 ms from a `Notifier`. |
| `logSim(String standardPrefix, String inputPrefix)` | Log supply voltage, applied voltage, position, velocity, rotor position, rotor velocity, and a `Mechanism2d` under `<standardPrefix>/Simulation/`.                  |
| `forceSetMotorVelocity(double unitsPerSecond)`      | Override the model's velocity. Used to simulate a load impulse.                                                                                                     |
| `getCTRESimState()`                                 | The underlying `TalonFXSimState`.                                                                                                                                   |
| `getSimState()`                                     | The library's `SimulatedTalonFXState` snapshot of the last update.                                                                                                  |
| `updateControlSignal(...)`                          | From maple-sim's `SimulatedMotorController`. Lets an external physics model feed encoder values in and read the motor voltage out.                                  |

:::info
Nothing calls `updateSimState()` on its own. The IO class that owns the sim motor has to start a `Notifier` for it. `CompoundMotorIOSim` does this automatically for every `MotorIOTalonFXSim` it contains. A single-motor sim IO like `HoodSimIO` creates its own.
:::

The elapsed time between updates is measured with the FPGA timestamp. If it comes out above 100 ms or at or below zero, it is replaced with 5 ms, so a paused simulator does not produce one enormous physics step when it resumes.

## MotorIOTalonFXCANCoderSim

Extends `MotorIOTalonFXSim` and adds a `CANcoderSimState`. Its constructors mirror the parent's with a `CANcoder` added as the last argument.

```java
import com.aembot.lib.core.motors.io.MotorIOTalonFXCANCoderSim;
```

The only override is `updateControlSignal`. Before calling the parent, it writes the mechanism angle and velocity into the CANcoder sim state and sets its supply voltage from maple-sim's simulated battery. This is what lets a simulated swerve module report a steering angle from its encoder. It is only used by the drivetrain simulation.

## MotorIOReplay

The replay implementation. Every setter returns `true` and does nothing. Every getter of a pair returns `(true, true)`. `getName()` returns `"Replay"`, `updateInputs` returns `true` without touching the inputs, and `hasResetOccurred()` returns `false`.

```java
import com.aembot.lib.core.motors.io.MotorIOReplay;
```

It exists so that subsystem logic runs without error while AdvantageKit supplies every input from the log file. It carries no configuration and needs none.

## Compound containers

`CompoundMotorIO<M extends MotorIO>` holds a list of motors for mechanisms with more than one. It is abstract, with a real, sim, and replay subclass. The subclasses are identical in behavior except that the sim one starts a notifier.

```java
import com.aembot.lib.core.motors.io.containers.CompoundMotorIOReal;
import com.aembot.lib.core.motors.io.containers.CompoundMotorIOSim;
import com.aembot.lib.core.motors.io.containers.CompoundMotorIOReplay;
```

| Member            | Description                                                      |
| ----------------- | ---------------------------------------------------------------- |
| `kMotors`         | Public final `List<M>`. An immutable copy of what was passed in. |
| `getMotor(int i)` | The motor at index `i`, or `null` if out of range.               |

Each subclass has three constructors: no motors, a `List<M>`, and varargs `M...`. `CompoundMotorIOSim` adds three more that take a `double periodicSeconds` first, to change the notifier period from the default 5 ms.

`CompoundMotorIOSim.simSetup()` looks through the motors for any that are `MotorIOTalonFXSim`, collects their `updateSimState` methods, and starts one `Notifier` that calls all of them. The notifier is named after the first motor. If the container is empty, no notifier is started.

:::warning
The `periodicSeconds` constructors set the period after the notifier has already started from the delegated constructor. The notifier keeps running at 5 ms and the custom period is never used.
:::

## Where it is used

`MotorSubsystem` holds an `M extends MotorIO` and calls `updateInputs` from `periodic()`. Its command methods call the control setters. Mechanism IO classes construct the right implementation and return it through `getMotor()`. `SubsystemFactory` in `frcXXXX` chooses between the compound containers for multi-motor mechanisms such as the intake rollers.
