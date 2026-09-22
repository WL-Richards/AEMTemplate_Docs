---
sidebar_position: 8
title: Camera Configuration
---

# Camera Configuration

`CameraConfiguration` describes one AprilTag camera: where it is, what it can see, and how much to trust it. `AprilVisionSubsystem` takes a list of them. `SimulatedCameraConfiguration` wraps one for PhotonVision's camera simulator.

```java
import com.aembot.lib.config.subsystems.vision.CameraConfiguration;
import com.aembot.lib.config.subsystems.vision.SimulatedCameraConfiguration;
```

## Constructing one

The constructor takes the camera name and type. For a Limelight the name must match the hostname set in its web interface, because that is the NetworkTables key the library reads from.

```java
new CameraConfiguration("limelight-front", CameraConfiguration.Type.LIMELIGHT)
```

For a Limelight 4 there is a factory that fills in the resolution, field of view, and filtering defaults.

```java
CameraConfiguration.makeLimelight4Config("limelight-front")
    .withCameraOffset(new Transform3d(...))
```

## Enums

| Enum         | Values                               | Notes                                                  |
| ------------ | ------------------------------------ | ------------------------------------------------------ |
| `Type`       | `LIMELIGHT`                          | The only camera type currently supported.              |
| `Resolution` | `P1280x960`, `P1280x720`, `P640x480` | Pixel dimensions. Used by the sim to model the camera. |
| `FOV`        | `LIMELIGHT4`                         | Horizontal and vertical field of view in degrees.      |

## Position

The camera's position is built from two parts so that a camera on a turret can move with it.

| Method                                  | Default                   | Description                                                                                        |
| --------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| `withMechanismOrigin(Supplier<Pose3d>)` | robot center, no rotation | Where the thing the camera is mounted to sits, relative to the robot. A supplier so it can change. |
| `withCameraOffset(Transform3d)`         | `null`                    | Where the camera is relative to that origin. Required.                                             |

`getCameraPosition()` composes the two and returns the camera's pose relative to the robot. For a camera bolted to the chassis, leave the origin at its default and put the full position in the offset.

```java
// A camera on a turret follows the turret angle
.withMechanismOrigin(() -> new Pose3d(0, 0, 0.3, new Rotation3d(0, 0, turretAngleRads)))
.withCameraOffset(new Transform3d(0.1, 0, 0.2, new Rotation3d(0, Math.toRadians(-20), 0)))
```

`getCameraPitch()` returns the camera's pitch with its yaw factored out, which is what the Limelight needs to know for its own pose solve.

## Optics

| Method                             | Default | Description       |
| ---------------------------------- | ------- | ----------------- |
| `withCameraResolution(Resolution)` | `null`  | Pixel dimensions. |
| `withCameraFOV(FOV)`               | `null`  | Field of view.    |

Both are set by the Limelight 4 factory and only matter in simulation.

## Trust

| Method                                    | Default            | Description                                                                                                  |
| ----------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `withBaselineTranslationalStdDev(double)` | `0.02`             | Position uncertainty in meters with one tag one meter away.                                                  |
| `withBaselineAngularStdDev(double)`       | `Double.MAX_VALUE` | Rotation uncertainty in radians under the same conditions. The default means never trust vision for heading. |
| `withBaslineStdDev(double, double)`       |                    | Both at once. Note the spelling.                                                                             |

The baseline is scaled by `avgDistance² / numTags` before being handed to the pose estimator, so a far tag is trusted much less than a near one, and two tags are trusted twice as much as one.

:::info
Limelight hardware computes its own standard deviations and the library may prefer those over the baseline. The baseline still matters in sim and as a fallback.
:::

## Filtering

Estimates that fail any of these checks are thrown away before reaching the pose estimator.

| Method                                             | Default               | Rejects when                                                                                       |
| -------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| `withMaxEstimateAgeSeconds(double)`                | `0.5`                 | The estimate is older than this.                                                                   |
| `withMaxOmegaForSingleTagRadians(double)`          | `50°/s`               | The robot is spinning faster than this and only one tag is seen.                                   |
| `withMaxOmegaForAnyTagRadians(double)`             | `150°/s`              | The robot is spinning faster than this at all.                                                     |
| `withMinTagDistanceMeters(double)`                 | `0.56`                | The tag is closer than this. Very close tags give bad solves.                                      |
| `withTagAreaThresholds(reject, far, medium, good)` | `0.05, 0.1, 1.0, 5.0` | Tag area in percent of image is below `reject`. The other three sort estimates into quality tiers. |
| `withMechanismAngularVelocity(Supplier<Double>)`   | `() -> 0.0`           | Provides the mount's rotation rate, for a camera on a turret.                                      |
| `withMaxMechanismOmegaRadians(double)`             | `Double.MAX_VALUE`    | The mount is rotating faster than this.                                                            |

## Limelight settings

These are written to the Limelight over NetworkTables and are meaningless for other camera types.

| Method                           | Default | Description                                                                      |
| -------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `withEnabledThrottleValue(int)`  | `0`     | Frames to skip between processed frames while enabled.                           |
| `withDisabledThrottleValue(int)` | `0`     | Frames to skip while disabled. Raise this to keep the Limelight cool in the pit. |
| `withEnabledIMUMode(int)`        | `1`     | Limelight IMU mode while enabled. See the Limelight docs for the values.         |
| `withDisabledIMUMode(int)`       | `1`     | Limelight IMU mode while disabled.                                               |

## SimulatedCameraConfiguration

`SimulatedCameraConfiguration` wraps a `CameraConfiguration` and builds a PhotonVision `SimCameraProperties` from its resolution and field of view. The constructor computes the diagonal field of view PhotonVision wants from the horizontal and vertical ones.

```java
new SimulatedCameraConfiguration(cameraConfig)
    .withFramerate(30)
    .withCameraLatency(35, 5)
    .withCalibrationError(0.25, 0.08)
```

| Method                                                 | Default                | Description                                                          |
| ------------------------------------------------------ | ---------------------- | -------------------------------------------------------------------- |
| `withFramerate(double)`                                | PhotonVision default   | Frames per second the sim camera produces.                           |
| `withCameraLatency(double avgMs, double stdDevMs)`     | PhotonVision default   | Delay from capture to publish.                                       |
| `withCalibrationError(double avgPx, double stdDevPx)`  | PhotonVision default   | Pixel noise on tag corners.                                          |
| `withSpecs(int width, int height, Rotation2d diagFOV)` | from the camera config | Resolution and FOV. Called by the constructor.                       |
| `withPoseEstimationStrategy(PoseStrategy)`             | `CONSTRAINED_SOLVEPNP` | Which PhotonVision solver to use in sim.                             |
| `withPoseNoise(double meters, double radians)`         | `0, 0`                 | Gaussian noise added to the solved pose, scaled by distance squared. |
| `withLatencyVariation(double stdDevMs)`                | `0`                    | Extra random latency on top of PhotonVision's own.                   |

The `simCameraProperties` field is public so the sim IO can hand it to PhotonVision directly.
