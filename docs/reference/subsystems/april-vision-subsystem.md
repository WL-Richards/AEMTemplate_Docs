---
sidebar_position: 10
title: April Vision Subsystem
---

# April Vision Subsystem

`AprilVisionSubsystem` turns raw AprilTag pose estimates from one or more cameras into a single filtered, weighted observation and hands it to `RobotState`. All filtering and weighting happens on the RIO from logged inputs, so it replays.

```java
import com.aembot.lib.subsystems.aprilvision.AprilVisionSubsystem;
```

Each camera is described by a [`CameraConfiguration`](../config/camera-configuration).

## Constructor

```java
new AprilVisionSubsystem(RobotState state, AprilCameraIO... cameras)
```

Takes any number of camera IOs. Each is paired with its own `AprilVisionInputs`. The constructor also applies the disabled NetworkTables settings to every camera and puts `Vision Enabled` on SmartDashboard.

## Periodic

For each camera:

1. Log the camera's field position from the current robot pose and the configured mount.
2. `io.updateInputs(inputs)`.
3. If there is a raw pose, at least one tag, and vision is active, and the estimate is younger than `maxEstimateAgeSeconds`, run `processRawEstimate`.
4. If that returns a pose, add it to the list of raw outputs and log the computed pose and standard deviations.
5. Read `Vision Enabled` from SmartDashboard.

Then the raw outputs are fused, the result is passed to `robotStateInstance.setApriltagObservations`, and counts are logged.

:::warning
The SmartDashboard read is not an AdvantageKit input and does not replay.
:::

### Processing an estimate

`processRawEstimate` does three things with a raw pose.

**Filter.** The estimate is rejected if the average tag distance is under `minTagDistanceMeters`, if the robot's yaw rate at the time of the estimate exceeds `maxOmegaForSingleTagRadians` (one tag) or `maxOmegaForAnyTagRadians` (more), or if the mounting mechanism's rate exceeds `maxMechanismOmegaRadians`. Each rejection reason is logged per camera.

**Transform.** Limelight returns a pose at the camera's XY location with the mechanism's yaw included. The mechanism yaw is subtracted and the camera offset is rotated into the field frame and removed, giving a robot center pose.

**Weight.** Standard deviations start from the Limelight's own MegaTag2 values (indices 6 and 7 of the 12 element array) when present and positive, or fall back to `baselineTranslationalStdDev * dist² / tagCount`. That is divided by a quality score from average tag area, with a 1.5x bonus for more than one tag, then multiplied by `1 + 0.5 * speed` and `1 + 0.5 * yawRate`. Rotation standard deviation is always `Double.MAX_VALUE`, so vision never corrects heading.

The quality score ramps through four configured tag area thresholds: below `tagAreaRejectThreshold` is 0.05, then linear segments to 0.3, 0.6, and 1.0 at the far, medium, and good thresholds.

### Fusing cameras

With more than one valid estimate, `fuseMultiCameraEstimates` previews each older pose forward to the newest timestamp using the odometry delta from `RobotState`, then combines them with inverse variance weighting. The fused standard deviation is `1 / sqrt(sum of 1/variance)`, so it is lower than any single camera. Rotation is taken from the first camera. The result is one `AprilCameraOutput` named `fused`.

If odometry for the latest timestamp is not available, the raw list is returned unfused and `FusePreviewFailed` is logged true.

## Commands

| Command                     | Description                                                                  |
| --------------------------- | ---------------------------------------------------------------------------- |
| `createKillVisionCommand()` | Sets `visionActive` false until the dashboard toggle turns it back on.       |
| `updateNTDisabledCommand()` | Push disabled throttle and IMU mode to every camera. Runs while disabled.    |
| `updateNTEnabledCommand()`  | Push enabled throttle and IMU mode. Bind to an enable trigger, not periodic. |

## AprilVisionInputs

Everything the RIO needs to recompute an estimate, and nothing that has already been computed.

| Field                            | Meaning                                                         |
| -------------------------------- | --------------------------------------------------------------- |
| `hasTag`                         | Tag count greater than zero.                                    |
| `latency`                        | Camera pipeline latency in ms. Not logged.                      |
| `rawCoprocessorPose`             | MegaTag2 pose as published. Null when there is no new estimate. |
| `rawStdDevsArray`                | The Limelight's 12 element stddevs array.                       |
| `avgTagDist`                     | Meters.                                                         |
| `avgTagArea`                     | Percent of image.                                               |
| `tagCount`                       |                                                                 |
| `coprocessorEstimationTimestamp` | Seconds, latency compensated.                                   |

## AprilCameraIO

| Method                             | Purpose                               |
| ---------------------------------- | ------------------------------------- |
| `getConfiguration()`               | The `CameraConfiguration`.            |
| `updateInputs(AprilVisionInputs)`  | Fill inputs.                          |
| `updateNetworkTablesForDisabled()` | Apply disabled throttle and IMU mode. |
| `updateNetworkTablesForEnabled()`  | Apply enabled throttle and IMU mode.  |

The interface also has a default `adjustStdDevsWithOdomPose` that scales by distance from odometry. The subsystem does not call it. It has its own version of the same idea, and that one is disabled with a comment explaining why.

### Limelight4IOHardware

Subscribes to `botpose_orb_wpiblue` on the camera's NetworkTable with a listener, so poses are cached the moment they arrive rather than polled. The listener parses the array, latency compensates the NT timestamp, and reads the stddevs array in the same callback so the two match.

`updateInputs` first pushes the robot's yaw to the camera through `SetRobotOrientation_NoFlush`, adding the mechanism yaw for a mounted camera. It then copies the cached estimate into inputs, but only if its timestamp differs from the last one used. The same frame is never fed twice.

The constructor tells the Limelight its mount as Z and rotation only, with X and Y at zero. That is why the subsystem removes the XY offset itself.

Camera temperature is logged as `<name>/tempCelsius` each loop.

### Limelight4IOSim

Extends the hardware IO. It runs a PhotonVision `PhotonCameraSim` and `PhotonPoseEstimator`, then writes the results into the same NetworkTable keys a real Limelight would publish. The hardware IO's listener picks them up unchanged, so the entire RIO side runs the same code in sim.

Optional noise from `SimulatedCameraConfiguration`: Gaussian position and yaw noise scaled by the square root of tag distance, and extra latency. The estimator is given the robot heading from `robot_orientation_set`, mirroring MegaTag2.

:::info
PhotonVision reports tag area as a percent, and the sim divides it by 100 before publishing. The hardware Limelight publishes percent directly, and the configured thresholds are in percent. Sim quality scores are likely lower than real ones for the same view.
:::

### AprilCameraReplayIO

Holds the configuration and does nothing else.

## Records

`VisionPoseEstimation` is `(Pose2d latencyUncompensatedPose, OdometryStandardDevs stdDevs, double timestampSeconds)`. The pose is at the time of capture. The drivetrain's pose estimator handles the latency using the timestamp.

`AprilCameraOutput` is `(String cameraName, VisionPoseEstimation estimatedPose)`. This is what `RobotState` stores and what the drive IO consumes.

## LimelightExtras

Two static helpers that `LimelightHelpers` does not provide.

| Method                               | Returns                                                |
| ------------------------------------ | ------------------------------------------------------ |
| `getStandardDeviations(String name)` | The `stddevs` array from NetworkTables.                |
| `getCameraTemperature(String name)`  | First element of the `hw` array, or -1 if it is short. |

`LimelightHelpers` itself is the vendor file from Limelight, copied in unchanged. Its methods are documented by Limelight, not here.
