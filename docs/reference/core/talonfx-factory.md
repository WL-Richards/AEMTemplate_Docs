---
sidebar_position: 2
title: TalonFX Factory
---

# TalonFX Factory

`TalonFXFactory` is where the library turns a description of a motor into a live `TalonFX` object. Every real TalonFX in the codebase is created through it. The factory applies the configuration with retries, wires up connection tracking, and registers the device with the CAN status logger, so that none of that has to be repeated in each IO class.

```java
import com.aembot.lib.core.motors.factories.TalonFXFactory;
```

All methods are static.

## Methods

| Method                                                                 | Returns                | Applies config       |
| ---------------------------------------------------------------------- | ---------------------- | -------------------- |
| `createIO(MotorConfiguration<TalonFXConfiguration> config)`            | `MotorIOTalonFX`       | From `config`        |
| `createRawWithConfig(CANDeviceID device, TalonFXConfiguration config)` | `TalonFX`              | The given config     |
| `createRawDefault(CANDeviceID device)`                                 | `TalonFX`              | `getDefaultConfig()` |
| `createRawNoConfig(CANDeviceID device)`                                | `TalonFX`              | Nothing              |
| `getDefaultConfig()`                                                   | `TalonFXConfiguration` | Not applicable       |

`createIO` is the one mechanism code uses. It is equivalent to `new MotorIOTalonFX(config)`, and that constructor calls `createRawWithConfig` internally. The `createRaw...` methods return a bare Phoenix 6 `TalonFX` with no library wrapper, and are for cases like the drivetrain where CTRE's own swerve classes own the motor.

## What createRawWithConfig does

This is the method everything else funnels through. In order:

1. Constructs a `TalonFX` on the CAN ID and bus from the `CANDeviceID`.
2. Clears sticky faults, so faults from a previous boot do not persist into this one.
3. Applies the `TalonFXConfiguration` through `CTREUtil.Configuration.Motors.applyConfiguration`, which retries up to ten times and reports to the Driver Station if it never succeeds.
4. Sets the device's supply voltage signal as its connection status signal at 100 Hz. `CANDeviceID.isConnected()` reads this.
5. Registers the `CANDeviceID` with `CANStatusLogger` for its bus.

`createRawNoConfig` does steps 1, 2, 4, and 5. `createRawDefault` is `createRawWithConfig` with the default configuration.

```java
TalonFX motor = TalonFXFactory.createRawWithConfig(device, config); // configured, tracked, registered
```

:::tip
Prefer `createIO` or `new MotorIOTalonFX(config)` over the raw methods. The raw `TalonFX` has no unit conversion, no clamping to soft limits, and no `MotorInputs` support. The IO wrapper adds all of that.
:::

## Default configuration

`getDefaultConfig()` returns a `TalonFXConfiguration` with every relevant setting stated explicitly, rather than left at whatever Phoenix 6 defaults to. It is used by `createRawDefault`.

| Group                 | Setting                               | Value                       |
| --------------------- | ------------------------------------- | --------------------------- |
| Motor output          | Neutral mode                          | `Coast`                     |
|                       | Inverted                              | `CounterClockwise_Positive` |
|                       | Duty cycle neutral deadband           | `0.04`                      |
|                       | Peak forward duty cycle               | `1.0`                       |
|                       | Peak reverse duty cycle               | `-1.0`                      |
| Current limits        | Supply current limit enable           | `false`                     |
|                       | Stator current limit enable           | `false`                     |
| Software limit switch | Forward soft limit enable             | `false`                     |
|                       | Forward soft limit threshold          | `0.0`                       |
|                       | Reverse soft limit enable             | `false`                     |
|                       | Reverse soft limit threshold          | `0.0`                       |
| Hardware limit switch | Forward limit enable                  | `false`                     |
|                       | Forward limit autoset position enable | `false`                     |
|                       | Forward limit source                  | `LimitSwitchPin`            |
|                       | Forward limit type                    | `NormallyOpen`              |
|                       | Reverse limit enable                  | `false`                     |
|                       | Reverse limit autoset position enable | `false`                     |
|                       | Reverse limit source                  | `LimitSwitchPin`            |
|                       | Reverse limit type                    | `NormallyOpen`              |
| Feedback              | Feedback sensor source                | `RotorSensor`               |
|                       | Feedback rotor offset                 | `0.0`                       |
|                       | Sensor to mechanism ratio             | `1.0`                       |
| Audio                 | Beep on boot                          | `true`                      |

:::warning
The default disables both current limits. Phoenix 6 itself enables them by default in current versions. A motor created with `createRawDefault` has no current limit at all until one is applied. Mechanism configurations in `frcXXXX` set their own limits and never use this default, but anything that does should add limits before running on a real robot.
:::

## Follower helpers

`TalonFXFactoryConfiguration` in `lib/config/motors/factories` holds two static helpers for building follower motor configurations. They are separate from the factory above because they build configuration objects, not hardware.

```java
import com.aembot.lib.config.motors.factories.TalonFXFactoryConfiguration;
```

| Method                                                                  | Returns                                                                                               |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `generateFollowerTalonFXConfiguration()`                                | A `FollowerConfiguration` wrapping an empty `MotorConfiguration` with a blank `TalonFXConfiguration`. |
| `generateFollowerTalonFXConfiguration(String name, CANDeviceID device)` | Same, with the name and CAN device filled in.                                                         |

Both return a `MotorFollowersConfiguration.FollowerConfiguration<TalonFXConfiguration>` that still needs `withSimConfig` and optionally `withFollowDirection` before `validate()` will pass.

```java
FollowerConfiguration<TalonFXConfiguration> follower =
    TalonFXFactoryConfiguration.generateFollowerTalonFXConfiguration("RollerFollower", followerDevice)
        .withFollowDirection(FollowDirection.INVERT) // spin opposite the leader
        .withSimConfig(followerSimConfig)
        .validate();
```

## Where it is used

`MotorIOTalonFX`'s main constructor calls `createRawWithConfig`. `FlywheelHardwareIO` calls `createIO`. The drivetrain does not use the factory, since CTRE's `SwerveDrivetrain` creates its own motors, and instead registers them with the status logger through `registerSwerveDrivetrain`.
