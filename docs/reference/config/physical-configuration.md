---
sidebar_position: 2
title: Physical Configuration
---

# Physical Configuration

`PhysicalConfiguration` describes the robot's chassis: how far apart the wheels are, how big the bumpers are, how much it weighs, and how well the wheels grip. The drivetrain simulation reads it to build a physics model, and it is where the season code records the numbers off the CAD.

```java
import com.aembot.lib.config.robot.PhysicalConfiguration;
```

It is passed to `DrivetrainSimConfiguration` and from there to the maple-sim drivetrain. See [Drivetrain Configuration](./drivetrain-configuration#drivetrainsimconfiguration).

## Fields

Every field is public and has a default that matches the 2026 production robot. Override each one for a new chassis.

| Method                                   | Default                        | Description                                                                |
| ---------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `withWheelBaseLengthM(double)`           | `Units.inchesToMeters(22.75)`  | Front axle to rear axle, in meters. The X dimension of the swerve chassis. |
| `withWheelTrackWidthM(double)`           | `Units.inchesToMeters(22.75)`  | Left wheel to right wheel on one axle, in meters. The Y dimension.         |
| `withBumperLengthM(double)`              | `Units.inchesToMeters(35.625)` | Full length including bumpers, in meters. Used for sim bounding boxes.     |
| `withBumperWidthM(double)`               | `Units.inchesToMeters(35.625)` | Full width including bumpers, in meters.                                   |
| `withRobotWeightPounds(double)`          | `150`                          | Total weight with battery and bumpers, in pounds. Drives sim acceleration. |
| `withWheelCoefficientOfFriction(double)` | `1.2`                          | Wheel to carpet friction. Sets the slip limit in sim. Above 1.0 is normal. |

:::info
Wheelbase and track width are measured wheel center to wheel center, not frame edge to frame edge. Bumper dimensions are the outside of the bumpers.
:::

## Example

```java
private static final PhysicalConfiguration PHYSICAL_CONFIGURATION =
    new PhysicalConfiguration()
        .withRobotWeightPounds(150)
        .withWheelBaseLengthM(Units.inchesToMeters(22.75))
        .withWheelTrackWidthM(Units.inchesToMeters(22.75))
        .withBumperLengthM(Units.inchesToMeters(35.625))
        .withBumperWidthM(Units.inchesToMeters(35.625))
        .withWheelCoefficientOfFriction(1.2);
```

## Pigeon2GyroConfiguration

`Pigeon2GyroConfiguration` wraps the CTRE `Pigeon2Configuration` for the drivetrain gyro and adds the two things the library needs to know: which CAN device it is, and how to correct its readings.

```java
import com.aembot.lib.config.robot.Pigeon2GyroConfiguration;
```

| Method                              | Default               | Description                                                           |
| ----------------------------------- | --------------------- | --------------------------------------------------------------------- |
| `withCANDevice(CANDeviceID)`        | `null`                | The Pigeon's CAN ID and bus. Required.                                |
| `withGyroYawScalar(double)`         | `1.0`                 | Correction for a gyro that over or under reports rotation. See below. |
| `withGyroMountRotation(Rotation3d)` | `Rotation3d(0, 0, 0)` | How the Pigeon is mounted relative to the robot, in radians.          |

The underlying `Pigeon2Configuration` is exposed as the public `config` field. Both `with` methods write through to it, so the CTRE object is always in sync and can be applied to the device directly.

### Yaw scalar

A Pigeon can report slightly more or less rotation than actually happened. To measure it, rotate the robot a known number of degrees, read the yaw the gyro reports, and set the scalar to `realYaw / reportedYaw`. The library writes it to the Pigeon's `GyroScalarZ` trim setting.

### Mount rotation

The Pigeon assumes it is mounted flat with its X axis pointing forward. If it is not, give the rotation from that orientation to the actual one. The library converts it to degrees and writes it to the Pigeon's mount pose settings. Roll, pitch, and yaw map to the X, Y, and Z components of the `Rotation3d`.

```java
new Pigeon2GyroConfiguration()
    .withCANDevice(new CANDeviceID(13, "Pigeon", "DriveSubsystem", CANDeviceType.PIGEON2, "Clyde"))
    .withGyroMountRotation(new Rotation3d(0, 0, Math.PI / 2)) // mounted 90 degrees off
    .withGyroYawScalar(1.0);
```
