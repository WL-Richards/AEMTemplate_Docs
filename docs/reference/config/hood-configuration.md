---
sidebar_position: 6
title: Hood Configuration
---

# Hood Configuration

`TalonFXHoodConfiguration` describes an adjustable shooter hood driven by one motor. `HoodSubsystem` takes one in its constructor, and `SimulatedHoodConfiguration` extends it with the sim motor for `HoodSimIO`.

```java
import com.aembot.lib.config.subsystems.hood.TalonFXHoodConfiguration;
import com.aembot.lib.config.subsystems.hood.simulation.SimulatedHoodConfiguration;
```

Unlike most subsystem configs, the motor configuration is a constructor argument rather than a builder method.

```java
new TalonFXHoodConfiguration(MOTOR_CONFIG, "HoodSubsystem")
```

## Builder methods

| Method                                  | Default           | Description                                                                                         |
| --------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| `withUpwardsHardStopUnits(double)`      | `0`               | Position of the upper hard stop in mechanism units. The subsystem sets the encoder to this at boot. |
| `withAutoAimLeniance(double)`           | `0`               | How far from the target angle the hood can be and still shoot. Counts both directions.              |
| `withHoodOriginPose(Pose3d)`            | `null`            | Where the hood pivot sits on the robot. Used for the AdvantageScope 3D mechanism.                   |
| `withGamePieceExitPoint(Translation3d)` | `Translation3d()` | Where game pieces leave the shooter, relative to the robot or the turret if there is one. Sim only. |

Fields are public: `kName`, `kMotorConfig`, `kHoodOriginPose`, `kGamePieceExitPoint`, `kAutoAimLeniance`, and `upwardsHardStopUnits`. The last one is the only field in the class without the `k` prefix.

:::info
The hood boots resting against its upper hard stop, so `upwardsHardStopUnits` doubles as the encoder zeroing value. If the hood is not at the hard stop on power up, every angle will be off by the difference.
:::

## SimulatedHoodConfiguration

`SimulatedHoodConfiguration` is a `TalonFXHoodConfiguration` with one extra field, `kSimMotorConfig`. Its constructor takes the `SimulatedMotorConfiguration` and the name, and pulls the real motor config out of the sim one so the two never disagree.

```java
new SimulatedHoodConfiguration(SIM_MOTOR_CONFIG, "HoodSubsystem")
```

It does not copy the builder fields from an existing real configuration. A robot config that sets the origin pose or leniency on the real hood needs to set them on the simulated one as well.

## Example

```java
public final TalonFXHoodConfiguration HOOD_CONFIG =
    new TalonFXHoodConfiguration(MOTOR_CONFIG, SUBSYSTEM_NAME)
        .withHoodOriginPose(HOOD_ORIGIN_POSE)
        .withGamePieceExitPoint(GAMEPIECE_EXIT_POINT_FROM_TURRET)
        .withUpwardsHardStopUnits(HARDSTOP_POS_DEGREES)
        .withAutoAimLeniance(AUTO_AIM_LENIANCY);

public final SimulatedHoodConfiguration SIMULATED_HOOD_CONFIG =
    new SimulatedHoodConfiguration(SIM_MOTOR_CONFIG, SUBSYSTEM_NAME);
```
