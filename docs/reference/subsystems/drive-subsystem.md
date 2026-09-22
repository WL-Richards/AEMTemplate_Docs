---
sidebar_position: 8
title: Drive Subsystem
---

# Drive Subsystem

`DriveSubsystem` wraps a CTRE swerve drivetrain. It owns no motors directly. The hardware IO extends CTRE's `SwerveDrivetrain`, which runs odometry on its own thread at 250 Hz, and the subsystem's job is to pull that state into inputs, push it into `RobotState`, and hand control requests back down.

```java
import com.aembot.lib.subsystems.drive.DriveSubsystem;
```

Configured with a [`DrivetrainConfiguration`](../config/drivetrain-configuration) plus one `SwerveModuleConfiguration` per module, both covered on that page.

## Constructor

```java
new DriveSubsystem(DrivetrainConfiguration config, DrivetrainIO io, RobotState state)
```

The constructor registers `io::addVisionEstimation` with `RobotState` so that every vision observation is forwarded into the CTRE pose estimator. It also creates a `SwerveVisualizer`.

`withSetPose(Pose2d)` calls `resetPose` and returns the subsystem, for chaining at construction.

## Periodic

Each loop, in order:

1. `io.updateInputs(inputs)` copies the latest cached swerve state and refreshes gyro and encoder signals.
2. `updateLog()` processes inputs and updates the visualizer.
3. `updateRobotState()` pushes odometry and chassis motion into `RobotState`.
4. `io.logModules` writes per module telemetry.
5. Odometry standard deviations are switched between the enabled and disabled sets from the configuration, based on `DriverStation.isDisabled()`.
6. `LatencyPeriodicMS` and `CurrentCommand` are logged.

### What goes into RobotState

`updateRobotState` uses `inputs.timestampRIOSynchronized`, not the current time, so measurements are stamped with when they were taken. It computes robot relative and field relative chassis speeds from the module states, a gyro fused field relative speed using the Pigeon's yaw rate, and the desired speeds from the module targets, then calls `addOdometryMeasurement` and `addChassisMotionMeasurements`.

## Control

| Method                                       | Description                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| `setRequest(SwerveRequest)`                  | Send a CTRE request once.                                                   |
| `applyRequest(Supplier<SwerveRequest>)`      | Command that sends the supplied request every loop. Requires the subsystem. |
| `setRequestFromChassisSpeeds(ChassisSpeeds)` | Wraps speeds in a `FieldCentric` velocity request.                          |
| `setRequestFromSwerveSample(SwerveSample)`   | Follow one Choreo sample. See below.                                        |
| `resetPose(Pose2d)`                          | Reset odometry. In sim this also teleports the physics model.               |
| `getSimDrivetrain()`                         | The `MapleSimSwerveDrivetrain`, or null outside sim.                        |

:::info
`setRequestFromChassisSpeeds` documents its argument as robot relative but builds a `FieldCentric` request. Choreo samples are field relative, so the Choreo path is correct. Pass field relative speeds.
:::

### Following Choreo

`setRequestFromSwerveSample` is the drivetrain's half of autonomous. Choreo's `AutoFactory` calls it once per loop with the trajectory sample for the current time. The subsystem adds a feedback correction to the sample's feedforward velocities using the two PID controllers from the configuration.

```java
vx = sample.vx + autoTranslationController.calculate(pose.getX(), sample.x);
vy = sample.vy + autoTranslationController.calculate(pose.getY(), sample.y);
omega = sample.omega + autoRotationController.calculate(pose.getRotation().getRadians(), sample.heading);
```

The result goes through `setRequestFromChassisSpeeds`. Tuning auto following means tuning `autoTranslationController` and `autoRotationController`.

### Deadbands

`applyDeadbands(ChassisSpeeds)` zeroes translation below `chassisTranslationSpeedThreshold` and rotation below `chassisRotationalSpeedThreshold`. It is protected and available to subclasses.

## Odometry standard deviations

`OdometryStandardDevs` is a record of `xStdDev`, `yStdDev`, and `rotStdDev`. Larger values mean the pose estimator trusts wheel odometry less and vision more.

| Method                                     | Applies                               |
| ------------------------------------------ | ------------------------------------- |
| `configureStandardDevsForEnabled()`        | `config.enabledOdometryStandardDevs`  |
| `configureStandardDevsForDisabled()`       | `config.disabledOdometryStandardDevs` |
| `setOdometryStdDevs(OdometryStandardDevs)` | Any set. Protected.                   |

`periodic()` calls one of the first two every loop, so setting them by hand elsewhere has no lasting effect. The disabled set is usually much looser, so vision can snap the robot to its true position before a match.

## DrivetrainInputs

`DrivetrainInputs` extends `AEMSwerveDriveState`, so it carries every field of CTRE's `SwerveDriveState` plus the following.

| Field                                                               | Source                                            |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| `timestampRIOSynchronized`                                          | CTRE timestamp converted to the RIO clock.        |
| `kinematics`                                                        | From the CTRE drivetrain.                         |
| `gyroYawAngle`                                                      | Pose rotation in degrees.                         |
| `yawAngularVelocity`, `rollAngularVelocity`, `pitchAngularVelocity` | Pigeon 2, degrees per second.                     |
| `pitch`, `roll`                                                     | Pigeon 2, degrees.                                |
| `accelX`, `accelY`                                                  | Pigeon 2.                                         |
| `absoluteEncoderPositions`                                          | CANcoder absolute position per module, rotations. |

`importSwerveDriveState` copies the CTRE fields from a cached state. `toLog` and `fromLog` are written by hand.

### AEMSwerveDriveState

CTRE's `SwerveDriveState.Timestamp` is on CTRE's clock. `AEMSwerveDriveState` adds `timestampRIOSynchronized` so downstream code can compare against `Timer.getFPGATimestamp()`. `fromSwerveDriveState` copies a plain state into one of these.

## DrivetrainIO

| Method                                       | Purpose                                               |
| -------------------------------------------- | ----------------------------------------------------- |
| `updateInputs(DrivetrainInputs)`             | Fill inputs.                                          |
| `logModules(DrivetrainInputs, String)`       | Per module logging with the module names from config. |
| `resetOdometry(Pose2d)`                      | Reset pose.                                           |
| `setRequest(SwerveRequest)`                  | Send a control request.                               |
| `setOdometryStdDevs(double, double, double)` | Update estimator trust.                               |
| `addVisionEstimation(AprilCameraOutput)`     | Feed a vision measurement to the estimator.           |

### DrivetrainHardwareIO

Extends `SwerveDrivetrain<TalonFX, TalonFX, CANcoder>`. The constructor builds the CTRE drivetrain from `ctreDriveConstants` and `ctreModuleConstants` at 250 Hz odometry, grabs Pigeon and CANcoder status signals, registers with `CANStatusLogger`, sets the odometry thread to priority 99, and registers a telemetry consumer that caches each `SwerveDriveState` with a RIO synchronized timestamp.

Signal rates: yaw velocity at 250 Hz, everything else at 100 Hz.

`updateInputs` returns early if no telemetry has arrived yet. `addVisionEstimation` ignores measurements with NaN standard deviations or NaN position, and always substitutes the gyro heading for the vision heading before calling `addVisionMeasurement`.

`logModules` writes absolute encoder angle, steer angle and target, drive velocity and target, and all four motor currents per module under `Modules/<name>/`.

### DrivetrainSimIO

Extends the hardware IO. The constructor passes the configuration through `MapleSimSwerveDrivetrain.regulateModuleConstantForSimulation` first, then starts a `Notifier` that steps the maple-sim physics at `simLoopPeriodS`. A second telemetry consumer pushes the simulated pose into `SimulatedRobotStateYearly`.

`resetOdometry` calls `teleportRobot`, which moves the physics body, waits 50 ms, then resets CTRE odometry. `getMapleSimDrive()` exposes the sim.

### DrivetrainIOReplay

Every method is a no-op.

## MapleSimSwerveDrivetrain

Bridges CTRE's swerve simulation and maple-sim. The constructor builds a `SwerveDriveSimulation` from robot mass, bumper size, module locations, motor models, wheel friction, and the first module's constants, then wraps each CTRE module in a `SimSwerveModuleConfiguration`. `update()` steps `SimulatedArena` and writes the simulated yaw and yaw rate into the Pigeon's sim state.

`regulateModuleConstantForSimulation` zeroes encoder offsets, disables all inversions, replaces steer gains with kP 70 and kD 4.5, and lowers friction voltages and steer inertia. It is a no-op on a real robot. The adjustments come from Team 254's public code and exist to avoid known sim bugs.

## SwerveVisualizer

Publishes four `LoggedMechanism2d` objects under `DriveViz`, one per module, with a ligament whose angle is the module angle and whose length is the module speed over twice the max robot speed. `updateSwerveState` is called from `updateLog`.

## JoystickDriveCommand

The teleop drive command. It requires the drive subsystem and never finishes.

| Factory                                | Rotation input                                                           |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `createCommandWithSteer(...)`          | Angular velocity from a `DoubleSupplier`.                                |
| `createCommandWithHeading(...)`        | A target `Rotation2d`. Uses `FieldCentricFacingAngle` with `headingPID`. |
| `createCommandWithRotationSwitch(...)` | Either, chosen each loop by a `BooleanSupplier`.                         |

All three take x and y `DoubleSupplier`s in the range -1 to 1 and a slow mode `BooleanSupplier`. Each loop, `execute()`:

1. Reads the suppliers.
2. Applies `driveJoystickDeadband` to translation and `steerJoystickDeadband` to rotation.
3. Scales by `maxDriveSpeed` and `maxAngularRate`.
4. Negates translation on the blue alliance so forward is always away from the driver.
5. Multiplies translation by `slowModeFactor` when slow mode is on.
6. Sends a `FieldCentric` or `FieldCentricFacingAngle` request depending on whether a heading was supplied.

:::info
`driveWithHeading` prints `driveWithHeading` to standard output every loop it runs. That is leftover debug output.
:::
