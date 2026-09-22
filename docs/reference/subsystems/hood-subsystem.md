---
sidebar_position: 7
title: Hood Subsystem
---

# Hood Subsystem

`HoodSubsystem` is a single motor angle mechanism. It extends `MotorSubsystem` and adds nothing beyond publishing its angle to a shared state object. Position commands come from the base class.

```java
import com.aembot.lib.subsystems.hood.HoodSubsystem;
```

Configured with a [`TalonFXHoodConfiguration`](../config/hood-configuration), or a `SimulatedHoodConfiguration` in sim.

## Constructor

```java
new HoodSubsystem(TalonFXHoodConfiguration config, HoodIO io, HoodState state)
```

The constructor sets the encoder to `config.upwardsHardStopUnits`. The hood is expected to boot resting against its upper hard stop, and that is the only zeroing it ever does. A `Hood Enabled` boolean is put on SmartDashboard.

## Periodic

After `super.periodic()`, each loop:

1. Converts `inputs.positionUnits` from degrees to a `Rotation2d` and writes it to `state`.
2. Logs `LatencyPeriodicMS`.
3. Reads `Hood Enabled` from SmartDashboard into `motorEnabled`.

:::warning
The SmartDashboard read is not an AdvantageKit input, so replay always sees `true`. Use `LoggedNetworkBoolean` for any toggle that has to replay correctly.
:::

## Commands

None of its own. Use `smartPositionSetpointCommand` from [`MotorSubsystem`](./motor-subsystem), with a target in degrees.

## HoodState

| Member                              | Description                                    |
| ----------------------------------- | ---------------------------------------------- |
| `hoodAngle`                         | `AtomicReference<Rotation2d>`, the last angle. |
| `getHoodAngle()`                    | Read it.                                       |
| `updateHoodAngle(Rotation2d value)` | Write it. Called from `periodic()`.            |

Logged as `Angle` under the state's prefix.

## HoodInputs

Empty. The hood has no sensors beyond the motor.

## HoodIO

```java
public interface HoodIO extends Loggable {
  public MotorIO getMotor();
  public void updateInputs(HoodInputs inputs);
}
```

| Implementation          | Constructor argument         | Motor returned      |
| ----------------------- | ---------------------------- | ------------------- |
| `TalonFXHoodHardwareIO` | `TalonFXHoodConfiguration`   | `MotorIOTalonFX`    |
| `HoodSimIO`             | `SimulatedHoodConfiguration` | `MotorIOTalonFXSim` |
| `HoodIOReplay`          | none                         | `MotorIOReplay`     |

The sim IO runs a 5 ms `Notifier` that steps the motor physics and logs sim state through `logSim`. The hardware IO creates the motor with `new MotorIOTalonFX(config.kMotorConfig)`, which applies the configuration through `TalonFXFactory`.
