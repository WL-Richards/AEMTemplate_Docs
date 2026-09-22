---
sidebar_position: 3
title: MotorFollowerSubsystem
---

# MotorFollowerSubsystem

`MotorFollowerSubsystem` is a [`MotorSubsystem`](./motor-subsystem) for a mechanism with one leader motor and any number of followers. The leader is controlled through every command the base class provides. The followers are told once, at construction, to copy the leader, and are otherwise only read for logging.

```java
import com.aembot.lib.subsystems.base.MotorFollowerSubsystem;
```

Unlike `MotorSubsystem`, it is not abstract. It can be used directly, and `BinaryVoltageMotorFollowerSubsytem` on the [premade subsystems](./premade-subsystems) page is a thin wrapper over it.

## Type parameters

| Parameter | Bound                 | Meaning                                                     |
| --------- | --------------------- | ----------------------------------------------------------- |
| `I`       | `extends MotorInputs` | Inputs type, one instance per motor.                        |
| `M`       | `extends MotorIO`     | IO type, one instance per motor.                            |
| `C`       | none                  | The vendor config type, for example `TalonFXConfiguration`. |

The third parameter is the raw vendor type, not a `MotorConfiguration`. The class passes `MotorConfiguration<C>` up to `MotorSubsystem` itself.

## Constructor

```java
public MotorFollowerSubsystem(
    I[] motorInputs, CompoundMotorIO<M> io, MotorFollowersConfiguration<C> config)
```

| Argument      | Contents                                                                    |
| ------------- | --------------------------------------------------------------------------- |
| `motorInputs` | One inputs object per motor. Index 0 is the leader.                         |
| `io`          | A `CompoundMotorIO` holding one `MotorIO` per motor. Index 0 is the leader. |
| `config`      | Leader and follower configurations. `validate()` is called on it.           |

The constructor takes the leader's inputs, IO, and config from index 0 and passes them to `MotorSubsystem`. It keeps the rest as followers, asserts that the three follower lists are the same length, and calls `follow` on each follower IO with the leader's `CANDeviceID` and that follower's direction.

`CompoundMotorIO` is a small abstract container in `lib/core/motors/io/containers` with a `kMotors` list and a `getMotor(int)` accessor. `CompoundMotorIOReal`, `CompoundMotorIOSim`, and `CompoundMotorIOReplay` are the three implementations. The sim one exists so each simulated motor gets its own update notifier.

:::info
Followers are configured once. The commented out block in `periodic()` that would re-send the follow request every loop is intentionally disabled.
:::

## Loop

`periodic()` calls the base version, then reads and logs each follower's inputs under `Inputs/Subsystems/<name>/Followers/<followerConfigName>`.

## Overridden methods

| Method                       | Behavior                                                                   |
| ---------------------------- | -------------------------------------------------------------------------- |
| `setEncoderPosition(double)` | Sets the leader and every follower.                                        |
| `zeroEncoderPosition()`      | Zeros the leader and every follower.                                       |
| `getCurrentPosition()`       | Average across leader and followers. Inverted followers are negated first. |
| `getCurrentVelocity()`       | Same, for velocity.                                                        |

A protected static helper, `generateFollowerInputs(MotorIO[])`, builds an array of fresh `MotorInputs` matching a motor array.

## MotorFollowersConfiguration

`MotorFollowersConfiguration<C>` in `lib/config/motors` describes the leader and its followers.

```java
import com.aembot.lib.config.motors.MotorFollowersConfiguration;
```

| Method                                                | Default    | Description                                                    |
| ----------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| `withLeaderConfig(MotorConfiguration<C>)`             | `null`     | Leader's motor configuration. Required.                        |
| `withLeaderSimConfig(SimulatedMotorConfiguration<C>)` | `null`     | Leader's simulated configuration. Required.                    |
| `withFollowerConfigs(List<FollowerConfiguration<C>>)` | empty list | One entry per follower, in motor order.                        |
| `validate()`                                          |            | Throws `VerifyError` naming any missing field. Returns itself. |

There is also a two-argument constructor taking the leader config and sim config directly.

### FollowerConfiguration

`MotorFollowersConfiguration.FollowerConfiguration<C>` describes one follower.

| Method                                          | Default                | Description                                              |
| ----------------------------------------------- | ---------------------- | -------------------------------------------------------- |
| `withConfig(MotorConfiguration<C>)`             | set by constructor     | The follower's own motor configuration.                  |
| `withSimConfig(SimulatedMotorConfiguration<C>)` | `null`                 | Simulated configuration. Required by `validate()`.       |
| `withFollowDirection(FollowDirection)`          | `FollowDirection.SAME` | `SAME` or `INVERT` relative to the leader.               |
| `validate()`                                    |                        | Throws `VerifyError` if config or sim config is missing. |

`FollowDirection` is an enum on `MotorIO`. `INVERT` is for a follower mounted facing the opposite way, which is the usual case for two motors on one shaft.

`TalonFXFactoryConfiguration` in `lib/config/motors/factories` has two static `generateFollowerTalonFXConfiguration` helpers that build a `FollowerConfiguration` with an empty `TalonFXConfiguration`, optionally with a name and `CANDeviceID`. A follower rarely needs more than that, since the leader's config governs the output.

## Example

Two motors on an intake roller, the second mounted mirrored.

```java
MotorFollowersConfiguration<TalonFXConfiguration> rollerConfig =
    new MotorFollowersConfiguration<TalonFXConfiguration>()
        .withLeaderConfig(LEAD_MOTOR_CONFIG)
        .withLeaderSimConfig(LEAD_SIM_CONFIG)
        .withFollowerConfigs(
            List.of(
                new FollowerConfiguration<>(FOLLOWER_MOTOR_CONFIG)
                    .withSimConfig(FOLLOWER_SIM_CONFIG)
                    .withFollowDirection(FollowDirection.INVERT)))
        .validate();
```
