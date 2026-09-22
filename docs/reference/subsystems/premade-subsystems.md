---
sidebar_position: 5
title: Premade Subsystems
---

# Premade Subsystems

Subsystems under `lib/subsystems/premades` are complete mechanisms that need only a configuration to use. There is one so far.

## BinaryVoltageMotorFollowerSubsytem

`BinaryVoltageMotorFollowerSubsytem` is a [`MotorFollowerSubsystem`](./motor-follower-subsystem) for a group of motors that is either running at a fixed voltage or stopped. Intake wheels, feeders, and anything else with an on/off switch fit it.

```java
import com.aembot.lib.subsystems.premades.BinaryVoltageMotorFollowerSubsytem;
```

:::info
The class name is misspelled in the source. `Subsytem`, not `Subsystem`. Autocomplete will find it either way, but a hand-typed import will not.
:::

### Constructor

```java
public BinaryVoltageMotorFollowerSubsytem(
    BinaryVoltageMotorFollowerConfig config, CompoundMotorIO<MotorIO> motorIOContainer)
```

It creates one `MotorInputs` per motor in the container and passes everything to `MotorFollowerSubsystem` along with `config.kMotorConfigs`. The subsystem name comes from the leader's motor configuration name, not from `config.kName`.

### Commands

| Method                   | Does                                |
| ------------------------ | ----------------------------------- |
| `runSystemCommand()`     | `voltageCommand` at `kRunVoltage`.  |
| `reverseSystemCommand()` | `voltageCommand` at `-kRunVoltage`. |
| `stopSystemCommand()`    | `voltageCommand` at 0.              |

All three run until interrupted and set zero volts on end. Every command from `MotorFollowerSubsystem` and `MotorSubsystem` is also available.

### Loop

`periodic()` wraps the base version and logs how long it took under `Subsystems/<name>/LatencyPeriodicMS`.

## BinaryVoltageMotorFollowerConfig

`BinaryVoltageMotorFollowerConfig` in `lib/config/subsystems/intake/generic/run` is the configuration.

```java
import com.aembot.lib.config.subsystems.intake.generic.run.BinaryVoltageMotorFollowerConfig;
```

| Method                                                                | Default | Description                                                               |
| --------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------- |
| `BinaryVoltageMotorFollowerConfig(String name)`                       |         | Constructor. Sets `kName`.                                                |
| `withMotorConfigs(MotorFollowersConfiguration<TalonFXConfiguration>)` | `null`  | Leader and followers. Required.                                           |
| `withIntakeVoltage(double)`                                           | `null`  | Sets `kRunVoltage`. Required.                                             |
| `validate()`                                                          |         | Throws `VerifyError` for missing fields, and validates the motor configs. |

`validate()` reports a missing voltage as `kIntakeVoltage`, the field's old name, rather than `kRunVoltage`.

### Example

```java
BinaryVoltageMotorFollowerConfig wheelsConfig =
    new BinaryVoltageMotorFollowerConfig("IntakeWheels")
        .withMotorConfigs(WHEEL_MOTOR_CONFIGS) // a MotorFollowersConfiguration
        .withIntakeVoltage(8.0)
        .validate();
```

The subsystem factory then builds a `CompoundMotorIOReal`, `CompoundMotorIOSim`, or `CompoundMotorIOReplay` from the same configuration depending on runtime mode and hands both to the constructor.
