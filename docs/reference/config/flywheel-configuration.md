---
sidebar_position: 5
title: Flywheel Configuration
---

# Flywheel Configuration

`TalonFXFlywheelConfiguration` describes a single motor flywheel: the motor, its simulated twin, and how close to the target speed counts as ready. `FlywheelSubsystem` takes one in its constructor.

```java
import com.aembot.lib.config.subsystems.flywheel.TalonFXFlywheelConfiguration;
```

The constructor takes the subsystem name.

```java
new TalonFXFlywheelConfiguration("FlywheelSubsystem")
```

## Builder methods

| Method                                                                        | Default        | Description                                                                                               |
| ----------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `withRealMotorConfig(MotorConfiguration<TalonFXConfiguration>)`               | `null`         | The motor. Required. See [Motor Configuration](./motor-configuration).                                    |
| `withSimulatedMotorConfig(SimulatedMotorConfiguration<TalonFXConfiguration>)` | `null`         | The simulated motor. Required for sim.                                                                    |
| `withSpeedToleranceUnitsPerSecond(double)`                                    | `0.2`          | How far from the setpoint the flywheel can be and still report at speed, in units per second either side. |
| `withAutoAimLeniance(double)`                                                 | `0`            | How far off the flywheel can be and still be allowed to shoot. Counts both directions.                    |
| `withSimulateLoadImpulseFunction(Function<Double, Double>)`                   | `(vel) -> vel` | Sim only. Given the current velocity, returns the velocity after a game piece passes through.             |

The fields are public with a `k` prefix: `kName`, `kMotorConfig`, `kSimMotorConfig`, `kSpeedToleranceUnitsPerSecond`, `kAutoAimLeniance`, and `kSimulateLoadImpulseFunction`.

## Units

The flywheel's units are whatever the motor configuration's unit ratios say they are. The production robot measures surface speed in meters per second, so the tolerance and leniency are also in meters per second. Nothing in this class converts anything.

## Load impulse

A real flywheel slows down when a game piece hits it. The default sim does not model that. `withSimulateLoadImpulseFunction` lets a robot config approximate it by handing the sim a function that maps pre-shot velocity to post-shot velocity.

```java
.withSimulateLoadImpulseFunction((vel) -> vel * 0.85) // lose 15 percent on each shot
```

## Example

```java
public final TalonFXFlywheelConfiguration CONFIG =
    new TalonFXFlywheelConfiguration("FlywheelSubsystem")
        .withSpeedToleranceUnitsPerSecond(0.2)
        .withRealMotorConfig(MOTOR_CONFIG)
        .withSimulatedMotorConfig(SIM_MOTOR_CONFIG)
        .withAutoAimLeniance(0.7);
```
