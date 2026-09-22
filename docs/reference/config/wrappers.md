---
sidebar_position: 10
title: Wrappers
---

# Wrappers

Small classes under `lib/config/wrappers` and `lib/config/motors` that make other configuration objects easier to build. None of them talk to hardware.

```java
import com.aembot.lib.config.wrappers.ConfigureSlot0Gains;
import com.aembot.lib.config.wrappers.PIDControllerBuilder;
import com.aembot.lib.config.motors.MotorFollowersConfiguration;
```

## ConfigureSlot0Gains

`ConfigureSlot0Gains` is a CTRE `Slot0Configs` with a seven-argument constructor, so a full set of gains fits on one line. It has no methods of its own. The class was taken from Team 2910's 2025 code.

```java
new ConfigureSlot0Gains(kP, kI, kD, kG, kS, kV, kA)
```

| Position | Gain | What it does                                                              |
| -------- | ---- | ------------------------------------------------------------------------- |
| 1        | kP   | Output per unit of error.                                                 |
| 2        | kI   | Output per unit of accumulated error. Usually zero.                       |
| 3        | kD   | Output per unit of error rate. Usually zero with Motion Magic.            |
| 4        | kG   | Constant output to hold against gravity. Arms and elevators.              |
| 5        | kS   | Output to overcome static friction. Sign follows the direction of motion. |
| 6        | kV   | Output per unit of velocity setpoint.                                     |
| 7        | kA   | Output per unit of acceleration setpoint.                                 |

:::warning
The order is not the order CTRE lists them in Tuner, and kG comes before kS and kV. Write the argument names in a comment above any call that is not obviously all zeros.
:::

It is accepted anywhere a `Slot0Configs` is, including `TalonFXConfiguration.withSlot0` and the swerve module builder's `withDriveMotorGains` and `withSteerMotorGains`.

## PIDControllerBuilder

`PIDControllerBuilder` collects constants for a WPILib `PIDController` and builds one on demand. It exists so gains can live in a configuration file as data and the controller can be created wherever it is needed.

| Method                                            | Description                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `withP(double)`, `withI(double)`, `withD(double)` | The three gains. All required.                                                                |
| `withIZone(double)`                               | Only accumulate integral error when within this range of the setpoint.                        |
| `withTolerance(double)`                           | Error below this counts as at setpoint.                                                       |
| `withContinuousInput(double lower, double upper)` | Treat the input as wrapping, for angles.                                                      |
| `generateController()`                            | Build a new `PIDController`. Returns `null` and reports an error if P, I, or D was never set. |

The fields are public boxed `Double`s so an unset gain is `null` rather than zero. Each call to `generateController` returns a fresh controller, so two subsystems built from the same builder do not share state.

```java
public static final PIDControllerBuilder HEADING_PID =
    new PIDControllerBuilder()
        .withP(5.0)
        .withI(0.0)
        .withD(0.1)
        .withContinuousInput(-Math.PI, Math.PI)
        .withTolerance(Math.toRadians(1));

PIDController controller = HEADING_PID.generateController();
```

:::info
The class comment mentions feedforward and output limits. Neither is implemented. `PIDController` does not have an output limit, and feedforward is handled outside it.
:::

## MotorFollowersConfiguration

`MotorFollowersConfiguration<C>` describes a leader motor and a list of followers. The type parameter is the vendor config type, `TalonFXConfiguration` in practice. `MotorFollowerSubsystem` and the intake roller configs take one.

| Method                                                | Description                                                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `withLeaderConfig(MotorConfiguration<C>)`             | The motor everything else follows.                                                             |
| `withLeaderSimConfig(SimulatedMotorConfiguration<C>)` | Its simulated twin.                                                                            |
| `withFollowerConfigs(List<FollowerConfiguration<C>>)` | Zero or more followers. Defaults to an empty list.                                             |
| `validate()`                                          | Throws `VerifyError` if the leader configs are missing or any follower fails its own validate. |

A two-argument constructor takes the leader real and sim configs directly.

Fields: `leaderConfig`, `leaderSimConfig`, `followerConfigurations`.

### FollowerConfiguration

`MotorFollowersConfiguration.FollowerConfiguration<C>` describes one follower. The constructor takes its `MotorConfiguration`.

| Method                                          | Default          | Description                                                                                                 |
| ----------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `withConfig(MotorConfiguration<C>)`             | from constructor | The follower's own motor config. Its CAN ID matters. Its gains do not, since it copies the leader's output. |
| `withSimConfig(SimulatedMotorConfiguration<C>)` | `null`           | Simulated twin. `validate` requires it.                                                                     |
| `withFollowDirection(FollowDirection)`          | `SAME`           | `SAME` spins with the leader. `INVERT` spins against it, for motors mounted mirror image.                   |
| `validate()`                                    |                  | Throws `VerifyError` if the config or sim config is missing.                                                |

`FollowDirection` is an enum on `MotorIO`. `FollowDirection.fromCTREAlignment` converts from CTRE's `MotorAlignmentValue` if a config is being ported from Tuner.

`TalonFXFactoryConfiguration.generateFollowerTalonFXConfiguration(name, device)` builds a `FollowerConfiguration` with an empty `TalonFXConfiguration`, which is all most followers need.

```java
public final MotorFollowersConfiguration<TalonFXConfiguration> ROLLER_MOTORS =
    new MotorFollowersConfiguration<>(LEAD_CONFIG, LEAD_SIM_CONFIG)
        .withFollowerConfigs(
            List.of(
                TalonFXFactoryConfiguration.generateFollowerTalonFXConfiguration(
                        "RollerFollower", FOLLOWER_DEVICE)
                    .withSimConfig(FOLLOWER_SIM_CONFIG)
                    .withFollowDirection(FollowDirection.INVERT)))
        .validate();
```
