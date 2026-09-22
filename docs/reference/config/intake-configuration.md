---
sidebar_position: 7
title: Intake Configuration
---

# Intake Configuration

Three configuration classes cover the intake mechanisms in the library. One is for a single roller motor, one for a leader with followers that runs at a fixed voltage, and one for the arm that deploys an over the bumper intake.

```java
import com.aembot.lib.config.subsystems.intake.generic.run.TalonFXIntakeRollerConfiguration;
import com.aembot.lib.config.subsystems.intake.generic.run.BinaryVoltageMotorFollowerConfig;
import com.aembot.lib.config.subsystems.intake.overBumper.deploy.TalonFXOverBumperIntakeDeployConfiguration;
```

## TalonFXIntakeRollerConfiguration

`TalonFXIntakeRollerConfiguration` describes one roller motor that runs at a set voltage. `IntakeRollerSubsystem` takes it. The constructor takes the subsystem name.

| Method                                                                         | Default | Description                                 |
| ------------------------------------------------------------------------------ | ------- | ------------------------------------------- |
| `withRealMotorConfiguration(MotorConfiguration<TalonFXConfiguration>)`         | `null`  | The motor. Required.                        |
| `withSimMotorConfiguration(SimulatedMotorConfiguration<TalonFXConfiguration>)` | `null`  | The simulated motor. Required for sim.      |
| `withIntakeVoltage(double)`                                                    | `0`     | Voltage applied when the roller is running. |

Fields: `kName`, `kRealMotorConfig`, `kSimMotorConfig`, `kIntakeVoltage`.

## BinaryVoltageMotorFollowerConfig

`BinaryVoltageMotorFollowerConfig` describes a leader motor with any number of followers, all of which are either on at one voltage or off. `IntakeRollerMultiMotorSubsystem` and `BinaryVoltageMotorFollowerSubsytem` take it. The constructor takes the subsystem name.

| Method                                                                | Default | Description                                                                         |
| --------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------- |
| `withMotorConfigs(MotorFollowersConfiguration<TalonFXConfiguration>)` | `null`  | Leader and follower motors. See [Wrappers](./wrappers#motorfollowersconfiguration). |
| `withIntakeVoltage(double)`                                           | `null`  | Voltage applied when running. Negated to run in reverse.                            |
| `validate()`                                                          |         | Throws `VerifyError` naming any unset field. Call last.                             |

Fields: `kName`, `kMotorConfigs`, `kRunVoltage`.

`validate` also validates the follower configuration inside it and includes its errors in the message. Call it at the end of the chain so a missing value fails at startup with a readable message instead of a `NullPointerException` mid-match.

:::info
`withIntakeVoltage` sets a field named `kRunVoltage`, and `validate` reports it as `kIntakeVoltage` when missing. All three names refer to the same value.
:::

```java
public final BinaryVoltageMotorFollowerConfig ROLLER_CONFIG =
    new BinaryVoltageMotorFollowerConfig("IntakeRollerSubsystem")
        .withMotorConfigs(ROLLER_MOTORS)
        .withIntakeVoltage(8.0)
        .validate();
```

## TalonFXOverBumperIntakeDeployConfiguration

`TalonFXOverBumperIntakeDeployConfiguration` describes the pivot arm that swings an intake out over the bumper. `OverBumperIntakeDeploySubsystem` takes it. The constructor takes the subsystem name.

The deploy arm zeroes itself by driving into a hard stop, so the configuration carries the angle of both stops and the voltage to use while finding them.

| Method                                                                               | Default | Description                                                                  |
| ------------------------------------------------------------------------------------ | ------- | ---------------------------------------------------------------------------- |
| `withRealMotorConfiguration(MotorConfiguration<TalonFXConfiguration>)`               | `null`  | The motor. Required.                                                         |
| `withSimulatedMotorConfiguration(SimulatedMotorConfiguration<TalonFXConfiguration>)` | `null`  | The simulated motor. Required for sim.                                       |
| `withZeroingVoltage(double)`                                                         | `0`     | Voltage applied while driving toward a hard stop. Positive.                  |
| `withInitialAngleDeg(double)`                                                        | `0`     | Angle the arm is at on boot, in degrees.                                     |
| `withUpwardsZeroAngleDeg(double)`                                                    | `0`     | Angle of the stowed hard stop. Encoder is set here after zeroing upward.     |
| `withDownwardsZeroAngleDeg(double)`                                                  | `0`     | Angle of the deployed hard stop. Encoder is set here after zeroing downward. |
| `withPivotPoint(Pose3d)`                                                             | `null`  | Where the pivot sits on the robot. For the AdvantageScope 3D mechanism.      |
| `withWidthMeters(double)`                                                            | `0`     | Intake width when deployed. Sim only, for maple-sim game piece pickup.       |
| `withExtensionMeters(double)`                                                        | `0`     | How far past the frame the intake reaches when deployed. Sim only.           |
| `withIntakeSide(IntakeSide)`                                                         | `null`  | Which side of the robot the intake is on. Sim only. A maple-sim enum.        |

Fields: `kName`, `kRealMotorConfig`, `kSimMotorConfig`, `kZeroingVoltage`, `kInitialAngleDeg`, `kUpwardsZeroAngleDeg`, `kDownwardsZeroAngleDeg`, `kPivotPoint`, `kWidthMeters`, `kExtensionMeters`, `kSide`.

:::tip
The two zero angles are what make the arm recoverable after a collision. If it gets knocked off its expected position, a zero command drives it into a stop and resets the encoder to the known angle of that stop.
:::
