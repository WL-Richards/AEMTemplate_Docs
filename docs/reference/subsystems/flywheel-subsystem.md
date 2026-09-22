---
sidebar_position: 6
title: Flywheel Subsystem
---

# Flywheel Subsystem

`FlywheelSubsystem` is a single motor velocity mechanism. It extends `MotorSubsystem`, so every velocity and duty cycle command comes from the base class. What it adds is a state object that other code can read to know whether the wheel is up to speed.

```java
import com.aembot.lib.subsystems.flywheel.FlywheelSubsystem;
```

Configured with a [`TalonFXFlywheelConfiguration`](../config/flywheel-configuration).

## Constructor

```java
new FlywheelSubsystem(TalonFXFlywheelConfiguration config, FlywheelIO io, FlywheelState state)
```

The constructor calls `zeroEncoderPosition()`, so position always starts at zero. A `Flywheel Enabled` boolean is also put on SmartDashboard.

## Periodic

After `super.periodic()` fills the motor inputs, the subsystem does the following each loop.

1. Writes the measured velocity into `state.flywheelSpeedUnitsPerSecond`.
2. Sets `state.atAcceptableSpeed` to true when the velocity is within `kSpeedToleranceUnitsPerSecond` of the current setpoint.
3. Logs `LatencyPeriodicMS`.
4. Reads `Flywheel Enabled` from SmartDashboard into `motorEnabled`.

:::warning
The SmartDashboard read is not an AdvantageKit input. In replay it returns the default of `true` regardless of what the operator set.
:::

## Commands

The flywheel adds no commands of its own. Use the velocity commands inherited from [`MotorSubsystem`](./motor-subsystem), typically `smartVelocitySetpointCommand`.

## FlywheelState

`FlywheelState` is the shared object the subsystem writes into. Command factories read it to decide when to feed a game piece.

| Field                         | Type                      | Meaning                                              |
| ----------------------------- | ------------------------- | ---------------------------------------------------- |
| `flywheelSpeedUnitsPerSecond` | `AtomicReference<Double>` | Measured velocity in configuration units per second. |
| `atAcceptableSpeed`           | `AtomicBoolean`           | True when within tolerance of the setpoint.          |

Both are logged under the state's prefix as `FlywheelSpeedMPS` and `AtAcceptableSpeed`.

## FlywheelInputs

Empty. The motor's own readings are covered by `MotorInputs` in the base class, and the flywheel has no other sensors.

## FlywheelIO

```java
public interface FlywheelIO extends Loggable {
  public void updateInputs(FlywheelInputs inputs);
  public MotorIO getMotor();
}
```

| Implementation       | Motor returned      | Notes                                                                |
| -------------------- | ------------------- | -------------------------------------------------------------------- |
| `FlywheelHardwareIO` | `MotorIOTalonFX`    | Built with `TalonFXFactory.createIO(config.kMotorConfig)`.           |
| `FlywheelSimIO`      | `MotorIOTalonFXSim` | Extends the hardware IO. Runs a 5 ms `Notifier` to step the physics. |
| `FlywheelReplayIO`   | `MotorIOReplay`     | No-op.                                                               |

:::info
`FlywheelSimIO` extends `FlywheelHardwareIO` and calls its constructor, so a real `MotorIOTalonFX` is also created in sim. It is never used, and the sim motor is what `getMotor()` returns.
:::

### Simulating a shot

A game piece passing through a real flywheel slows it down. The sim IO can reproduce that.

```java
simIO.simulateImpulseLoad();
```

This reads the current simulated velocity, passes it through `kSimulateLoadImpulseFunction` from the configuration, and forces the sim motor to the returned velocity. The default function returns the velocity unchanged, so nothing happens until a configuration supplies one.

```java
new TalonFXFlywheelConfiguration("Flywheel")
    .withSimulateLoadImpulseFunction((vel) -> vel * 0.85); // lose 15% per shot
```

## SimulatedShooterFlywheelState

`SimulatedShooterFlywheelState` launches a simulated game piece into the maple-sim arena and fires a callback so the flywheel sim can apply its load impulse.

| Method                                                 | Description                                                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `simulateShot(Transform3d exitPoint, double speedMps)` | Adds a projectile to `SimulatedArena` from the robot's current pose, then runs the fire callback. |
| `setSimulateFireCallback(Runnable callback)`           | Registers what to run on each shot. Wire it to `FlywheelSimIO::simulateImpulseLoad`.              |

The last projectile's trajectory is logged as a `Pose3d[]` under `SimulatedShotTrajectory` so it shows in AdvantageScope's 3D field.
