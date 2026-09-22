---
sidebar_position: 1
title: Robot State
---

# Robot State

`RobotState` is the one object that knows where the robot is and what its mechanisms are doing. Subsystems write into it from their periodic loops and commands read from it. It is abstract in the library, and each season provides a singleton subclass named `RobotStateYearly`.

```java
import com.aembot.lib.state.RobotState;
import com.aembot.lib.state.SimulatedRobotState;
```

The class exists so that a command that needs the robot pose or the hood angle does not have to hold a reference to the drivetrain or the hood. It asks the state instead. That keeps commands from requiring subsystems they only want to read from.

## Thread safety

Every field in `RobotState` is designed to be read and written from different threads at the same time. Odometry runs on its own thread at a higher rate than the main loop, and vision results arrive whenever a camera finishes a frame. The class comment puts it in capitals: the states stored in this should all be thread safe.

Two tools are used to get there.

**`AtomicReference<T>`** wraps a single value so that `get()` and `set()` are atomic. A reader always sees a complete value, never a half written one. Every scalar in the state model is one of these, and mechanism state classes follow the same rule.

```java
public AtomicReference<Rotation2d> hoodAngle = new AtomicReference<>();

hoodAngle.set(angle); // from the hood's periodic
Rotation2d now = hoodAngle.get(); // from a command, on any thread
```

**`ConcurrentTimeInterpolatableBuffer<T>`** holds a time series and lets a reader ask for the value at any timestamp. Odometry and gyro data go into these so that a vision measurement with a known capture time can be matched to where the robot was at that instant. The buffer is covered on the [Math](../math/math-utilities#concurrenttimeinterpolatablebuffer) page.

:::tip
A plain `double` or object field is not safe to share between threads, even with `volatile`. If a value is written by a subsystem and read by anything else, wrap it in an `AtomicReference` or `AtomicBoolean`.
:::

## Odometry

The inner `Odometry` class holds everything about where the robot is and how it is moving. It is not exposed directly. The methods on `RobotState` read and write it.

| Field                                  | Type                             | Description                                                                  |
| -------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| `timeInterpolatableEstimatedRobotPose` | Buffer of `Pose2d`               | Fused pose estimate including vision corrections.                            |
| `driveYawAngularVelocity`              | Buffer of `Double`               | Gyro yaw rate in rad/s.                                                      |
| `drivePitchAngularVelocity`            | Buffer of `Double`               | Gyro pitch rate in rad/s.                                                    |
| `driveRollAngularVelocity`             | Buffer of `Double`               | Gyro roll rate in rad/s.                                                     |
| `drivePitchRads`                       | Buffer of `Double`               | Pitch angle.                                                                 |
| `driveRollRads`                        | Buffer of `Double`               | Roll angle.                                                                  |
| `driveAccelX`, `driveAccelY`           | Buffer of `Double`               | Accelerometer, m/s².                                                         |
| `actualRobotRelativeChassisSpeeds`     | `AtomicReference<ChassisSpeeds>` | Measured from module encoders.                                               |
| `actualFieldRelativeChassisSpeeds`     | `AtomicReference<ChassisSpeeds>` | The same, rotated into field frame.                                          |
| `desiredRobotRelativeChassisSpeeds`    | `AtomicReference<ChassisSpeeds>` | What the drive was last commanded to do.                                     |
| `desiredFieldRelativeChassisSpeeds`    | `AtomicReference<ChassisSpeeds>` | The same, in field frame.                                                    |
| `gyroFusedChassisSpeeds`               | `AtomicReference<ChassisSpeeds>` | Field relative speeds with the gyro's rotation rate instead of the modules'. |

Every buffer keeps `RobotStateConstants.Kinematics.BUFFER_WINDOW_LENGTH` seconds of history, which is one second. The pose buffer is seeded with `Pose2d.kZero` at time zero so it is never empty.

## Methods

### Writing

| Method                                                           | Called by        | Description                                                                                                                                                     |
| ---------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `addOdometryMeasurement(double timestamp, Pose2d pose)`          | Drive subsystem  | Add a pose sample to the estimate buffer.                                                                                                                       |
| `addChassisMotionMeasurements(...)`                              | Drive subsystem  | Add one sample to every gyro and accelerometer buffer and set all five chassis speed references. Thirteen arguments, in the order the buffers are listed above. |
| `setApriltagObservations(List<AprilCameraOutput>)`               | Vision subsystem | Replace the current observation list and hand each one to every registered consumer.                                                                            |
| `registerAprilCameraOutputConsumer(Consumer<AprilCameraOutput>)` | Anyone           | Be called with every new AprilTag observation as it arrives.                                                                                                    |

### Reading

| Method                                              | Returns                                                                          |
| --------------------------------------------------- | -------------------------------------------------------------------------------- |
| `getLatestFieldRobotPose()`                         | Newest pose in the estimate buffer, or `null` if empty.                          |
| `getFieldRobotPoseForTimestamp(double seconds)`     | Pose interpolated at that time, or `null` if the buffer is empty.                |
| `getAprilTagObservations()`                         | The current observation list.                                                    |
| `getLatestMeasuredFieldRelativeChassisSpeeds()`     | `actualFieldRelativeChassisSpeeds`                                               |
| `getLatestRobotRelativeChassisSpeed()`              | `actualRobotRelativeChassisSpeeds`                                               |
| `getLatestDesiredRobotRelativeChassisSpeeds()`      | `actualRobotRelativeChassisSpeeds`. See note.                                    |
| `getLatestDesiredFieldRelativeChassisSpeed()`       | `actualFieldRelativeChassisSpeeds`. See note.                                    |
| `getLatestFusedFieldRelativeChassisSpeed()`         | `gyroFusedChassisSpeeds`                                                         |
| `getYawAngularVelocityForTimestamp(double seconds)` | Interpolated yaw rate, or the current field relative omega if not in the buffer. |

:::warning
The two `getLatestDesired...` methods return the actual speeds, not the desired ones. The desired references are written by `addChassisMotionMeasurements` but nothing reads them. Anything relying on these getters is getting measured speeds.
:::

### Logging

`RobotState` implements `Loggable`. The base `updateLog` writes the latest estimated pose to `SensorRobotState/RobotPose2d`. `Robot.robotPeriodic` calls `RobotStateYearly.get().updateLog()` every loop.

## Extending it for a season

The season class is a singleton that adds a field per mechanism, logs mechanism poses for AdvantageScope, and calls `updateLog` on each mechanism state.

```java
public class RobotStateYearly extends RobotState {
  private static final RobotStateYearly INSTANCE = new RobotStateYearly();

  public final HoodState hoodState = new HoodState();
  public final FlywheelState shooterFlywheelState = new FlywheelState();
  public final AtomicReference<OverBumperIntakeDeployState> intakeDeployState =
      new AtomicReference<>();

  public static RobotStateYearly get() {
    return INSTANCE;
  }

  @Override
  public void updateLog(String standardPrefix, String inputPrefix) {
    super.updateLog(standardPrefix, inputPrefix); // logs the pose
    // ...compute Pose3d for each mechanism and log the array
    hoodState.updateLog("SensorRobotState/Hood", "");
    shooterFlywheelState.updateLog("SensorRobotState/ShooterFlywheel", "");
  }
}
```

Subsystems are handed the specific state object they update, not the whole `RobotStateYearly`. The hood takes a `HoodState` in its constructor and calls `state.updateHoodAngle(...)` from `periodic`. That keeps library subsystems from depending on the season class.

The mechanism pose array logged under `SensorRobotState/MechanismPositions` is what AdvantageScope's 3D field uses to draw articulated components. Its order has to match the order of components in the robot model config.

## Mechanism state classes

Each mechanism has a small `Loggable` class under `lib/state/subsystems`. They hold only what other code needs to read, wrapped in atomics.

| Class                         | Fields                                                                                   | Logged as                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `HoodState`                   | `AtomicReference<Rotation2d> hoodAngle`                                                  | `<prefix>/Angle`                                           |
| `FlywheelState`               | `AtomicReference<Double> flywheelSpeedUnitsPerSecond`, `AtomicBoolean atAcceptableSpeed` | `<prefix>/FlywheelSpeedMPS`, `<prefix>/AtAcceptableSpeed`  |
| `IntakeRollerState`           | `AtomicReference<Double> angularVelocityUnitsPerMin`, `AtomicBoolean isActive`           | `<prefix>/angularVelocityUnitsPerMin`, `<prefix>/isActive` |
| `OverBumperIntakeDeployState` | `double deployPositionUnits`, `boolean isDeployed`                                       | `<prefix>/deployPosition `, `<prefix>/isDeployed`          |

`HoodState` has `getHoodAngle()` and `updateHoodAngle(Rotation2d)` wrappers. The others expose their atomics directly.

:::info
`OverBumperIntakeDeployState` uses plain fields rather than atomics. It is safe only because the whole object is replaced through an `AtomicReference` in `RobotStateYearly` rather than mutated in place. Its `deployPosition ` log key also has a trailing space, which is a typo that has made it into logs.
:::

## SimulatedRobotState

`SimulatedRobotState` is the simulation counterpart. Where `RobotState` holds the robot's estimate of itself, this holds the truth: the exact pose maple-sim says the robot is at, and the physics of anything that interacts with the field. It exists only in `SIM` mode. `SimulatedRobotStateYearly` is the season singleton.

| Field or method                                             | Description                                                                      |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `positionState.timeInterpolatableSimulatedRobotPose`        | Buffer of the true pose. Written by the drivetrain sim.                          |
| `visionSimulation`                                          | PhotonVision `VisionSystemSim`. Cameras are registered into it.                  |
| `updateState()`                                             | Push the latest true pose into the vision sim. Called from `simulationPeriodic`. |
| `updateSimulatedPosition(Pose2d)`                           | Add a true pose sample at the current FPGA time. Synchronized.                   |
| `getLatestFieldRobotPose()`                                 | Newest true pose, or `null`.                                                     |
| `addCameraToVisionSimulation(PhotonCameraSim, Transform3d)` | Register a simulated camera and return the vision sim.                           |
| `updateLog(...)`                                            | Logs the true pose to `SimulatedRobotState/RobotPose2d`.                         |

A season subclass must call `visionSimulation.addAprilTags(...)` with the year's layout in its constructor, or the simulated cameras see an empty field.

### Simulated mechanism states

Two library classes model mechanisms that interact with game pieces in sim. Both are `Loggable` and live under `lib/state/subsystems`.

**`SimulatedShooterFlywheelState`** fires a maple-sim projectile from a robot relative exit point at a given speed, using the real `RobotState` for the robot's pose and velocity. `simulateShot(Transform3d exitPoint, double speedMps)` does the launch and calls an optional `Runnable` set with `setSimulateFireCallback`, which the flywheel sim uses to drop its velocity as if a game piece had passed through. The last trajectory is logged as a `Pose3d[]`.

**`SimulatedOverBumperIntakeState`** wraps a maple-sim `IntakeSimulation`. It needs the drivetrain sim before it can initialize, which `SubsystemFactory` provides through `setDriveSim(...)` when it creates the drive. `update()` starts or stops the intake collider based on whether the deploy state says it is down. `pullGamePiece()` removes one held piece and returns whether there was one, which is how the season's `updateState` decides to fire a shot.
