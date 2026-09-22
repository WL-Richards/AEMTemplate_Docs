---
sidebar_position: 4
title: Drivetrain Configuration
---

# Drivetrain Configuration

The swerve drivetrain is described by a handful of classes that feed into CTRE's swerve API. `DrivetrainConfiguration` covers the whole chassis, one `SwerveModuleConfiguration` covers each module, and `DrivetrainSimConfiguration` adds what the simulator needs. All of them live under `lib/config/subsystems/drive`.

```java
import com.aembot.lib.config.subsystems.drive.DrivetrainConfiguration;
import com.aembot.lib.config.subsystems.drive.TalonFXSwerveModuleConfiguration;
import com.aembot.lib.config.subsystems.drive.simulation.DrivetrainSimConfiguration;
import com.aembot.lib.config.odometry.OdometryStandardDevs;
```

## DrivetrainConfiguration

`DrivetrainConfiguration` holds everything about the drivetrain that is not specific to one module: speed limits, joystick deadbands, gyro, odometry trust, and the controllers used in auto. `DriveSubsystem` takes one in its constructor.

| Method                                                                                  | Description                                                                                                                      |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `withName(String)`                                                                      | Name used in logs.                                                                                                               |
| `withGyroDevice(CANDeviceID)`                                                           | The Pigeon's CAN ID and bus.                                                                                                     |
| `withModuleConstants(SwerveModuleConstants[])`                                          | CTRE module constants in FL, FR, BL, BR order. Usually built by calling `getCtreModuleConstants()` on each module configuration. |
| `withDrivetrainConstants(SwerveDrivetrainConstants)`                                    | CTRE chassis constants: CAN bus name, Pigeon ID, and Pigeon config.                                                              |
| `withMaxDriveSpeed(double)`                                                             | Fastest the drivetrain will be commanded to go, in m/s. A driving limit, not the physical maximum.                               |
| `withMaxAngularRate(double)`                                                            | Fastest the drivetrain will be commanded to spin, in rad/s.                                                                      |
| `withJoystickDeadband(double steer, double drive)`                                      | Stick inputs below these magnitudes are treated as zero. Steer is the right stick, drive is the left.                            |
| `withChassisSpeedDeadband(double mps, double radps)`                                    | Commanded speeds below these are treated as zero. Stops the modules twitching at rest.                                           |
| `withslowModeFactor(double)`                                                            | Multiplier applied to speed while slow mode is held. Note the lowercase `s`.                                                     |
| `withOdometryStandardDevs(OdometryStandardDevs enabled, OdometryStandardDevs disabled)` | How much to trust wheel odometry in the pose estimator. See [OdometryStandardDevs](#odometrystandarddevs).                       |
| `withHeadingPIDConstants(PIDConstants)`                                                 | Gains for holding a heading in teleop drive modes.                                                                               |
| `withAutoTranslationController(PIDController)`                                          | Controller Choreo uses to track X and Y during auto.                                                                             |
| `withAutoRotationController(PIDController)`                                             | Controller Choreo uses to track heading during auto. Continuous input from -π to π is enabled on it for you.                     |

None of these have defaults. Every field starts as zero or `null`, so a drivetrain configuration that skips a method will fail in a confusing way. Set all of them.

:::info
`withAutoRotationController` modifies the controller you pass in by enabling continuous input. Do not share that controller with anything else.
:::

## SwerveModuleConfiguration

`SwerveModuleConfiguration<DC, SC, SE>` is the abstract base for one module. The three type parameters are the config types for the drive motor, steer motor, and steer encoder. `TalonFXSwerveModuleConfiguration` is the only implementation and fixes them to `TalonFXConfiguration`, `TalonFXConfiguration`, and `CANcoderConfiguration`.

The constructor takes the module name and the three `CANDeviceID`s.

```java
new TalonFXSwerveModuleConfiguration("FrontLeft", driveMotorID, steerMotorID, encoderID)
```

A second constructor accepts a prebuilt CTRE `SwerveModuleConstants` and uses its initial configs, for teams that generate constants with Tuner X and want to keep them.

### Builder methods

Every method returns the base `SwerveModuleConfiguration`, so the chain works the same on either constructor.

| Method                                     | Default          | Description                                                                              |
| ------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------- |
| `withWheelRadiusM(double)`                 | `0`              | Wheel radius in meters.                                                                  |
| `withDriveGearBox(MultistageGearBox)`      | `null`           | Reduction from drive motor to wheel. The first stage is also used as the coupling ratio. |
| `withSteerGearBox(MultistageGearBox)`      | `null`           | Reduction from steer motor to module rotation.                                           |
| `withDriveMotorType(DCMotor)`              | `null`           | Motor model, for example `DCMotor.getKrakenX60(1)`. Used to compute free speed.          |
| `withLocationOffset(double x, double y)`   | `null`           | Module position from robot center in meters. Positive X forward, positive Y left.        |
| `withEncoderOffsetRotations(double)`       | `0`              | True zero minus reported zero of the steer encoder, in rotations.                        |
| `withDriveMotorGains(ConfigureSlot0Gains)` | `null`           | Closed loop gains for the drive motor.                                                   |
| `withSteerMotorGains(ConfigureSlot0Gains)` | `null`           | Closed loop gains for the steer motor.                                                   |
| `withDriveFrictionVoltage(double)`         | `0`              | Voltage needed to start the wheel moving. Same idea as kS.                               |
| `withSteerFrictionVoltage(double)`         | `0`              | Voltage needed to start the module turning.                                              |
| `withDriveInertia(double)`                 | `0`              | Rotational inertia of the drive side in kg·m². Sim only.                                 |
| `withSteerInertia(double)`                 | `0`              | Rotational inertia of the steer side in kg·m². Sim only.                                 |
| `withDriveMotorSupplyCurrentLimit(double)` | `0`              | Battery current cap for the drive motor, in amps.                                        |
| `withDriveMotorStatorCurrentLimit(double)` | `0`              | Winding current cap for the drive motor, in amps.                                        |
| `withDriveMotorSlipCurrent(double)`        | `0`              | Current at which the wheel is expected to slip. CTRE uses it to limit torque.            |
| `withDriveMotorInverted(boolean)`          | `false`          | Flip drive direction.                                                                    |
| `withSteerMotorInverted(boolean)`          | `false`          | Flip steer direction.                                                                    |
| `withSteerEncoderInverted(boolean)`        | `false`          | Flip encoder direction.                                                                  |
| `withDriveNeutralMode(NeutralMode)`        | `BRAKE`          | Drive motor behavior at zero output.                                                     |
| `withSteerNeutralMode(NeutralMode)`        | `BRAKE`          | Steer motor behavior at zero output.                                                     |
| `withDriveMotor(CANDeviceID)`              | from constructor | Replace the drive motor ID.                                                              |
| `withSteerMotor(CANDeviceID)`              | from constructor | Replace the steer motor ID.                                                              |
| `withSteerEncoder(CANDeviceID)`            | from constructor | Replace the encoder ID.                                                                  |

There are also seven-argument overloads of `withDriveMotorGains` and `withSteerMotorGains` that take the gains as individual doubles.

:::warning
The seven-argument overloads declare their parameters in the order `kP, kI, kD, kV, kS, kG, kA` but pass them to `ConfigureSlot0Gains`, whose constructor takes `kP, kI, kD, kG, kS, kV, kA`. The kV and kG values end up swapped. Until that is fixed, build a `ConfigureSlot0Gains` yourself and pass it to the single-argument overload.
:::

### Getters

| Method                                                          | Returns                                                                                  |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `getCtreModuleConstants()`                                      | The CTRE `SwerveModuleConstants` built from everything above. Built once and cached.     |
| `getDriveMotorConfiguration()`                                  | A `TalonFXConfiguration` with the drive current limits and neutral mode applied.         |
| `getSteerMotorConfiguration()`                                  | Same for the steer motor.                                                                |
| `getSteerEncoderConfiguration()`                                | An empty `CANcoderConfiguration`.                                                        |
| `getMaxSpeedMetersPerSecond()`                                  | Theoretical free speed at the wheel, from the motor model, gear ratio, and wheel radius. |
| `getDriveMotorID()`, `getSteerMotorID()`, `getSteerEncoderID()` | The three CAN devices.                                                                   |

`getCtreModuleConstants` is what `DriveSubsystem` and the simulator actually consume. It fixes several CTRE options that the builder does not expose: closed loop output is voltage, motors are integrated TalonFX, and steer feedback is a fused CANcoder.

:::warning
`getCtreModuleConstants` reads the cached max speed field without calling `getMaxSpeedMetersPerSecond()` first. If nothing has called the getter yet, the CTRE constants are built with `NaN` for speed at 12 volts. Call `getMaxSpeedMetersPerSecond()` on each module before `getCtreModuleConstants()`, or expect odd behavior.
:::

## SimSwerveModuleConfiguration

`SimSwerveModuleConfiguration` is a thin wrapper that connects one CTRE swerve module to its maple-sim counterpart. The constructor attaches a `MotorIOTalonFXSim` to the sim module's drive motor and a `MotorIOTalonFXCANCoderSim` to its steer motor and encoder. It is constructed by `DrivetrainSimIO` and not by season code.

| Field             | Type                     | Description                         |
| ----------------- | ------------------------ | ----------------------------------- |
| `moduleConstants` | `SwerveModuleConstants`  | The CTRE constants for this module. |
| `mapleSimModule`  | `SwerveModuleSimulation` | The maple-sim module being driven.  |

## DrivetrainSimConfiguration

`DrivetrainSimConfiguration` holds what the simulator needs beyond the real configuration. The constructor takes the sim loop period in seconds.

```java
new DrivetrainSimConfiguration(0.005) // sim physics steps at 200 Hz
```

| Method                                             | Description                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `withName(String)`                                 | Name used in logs.                                                                                |
| `withPhysicalConfiguration(PhysicalConfiguration)` | Chassis dimensions, weight, and friction. See [Physical Configuration](./physical-configuration). |
| `withDriveMotorsPerModule(int)`                    | Motors driving each wheel. Usually 1.                                                             |
| `withSteerMotorsPerModule(int)`                    | Motors steering each module. Usually 1.                                                           |

## OdometryStandardDevs

`OdometryStandardDevs` is a record of three doubles: `xStdDev`, `yStdDev`, and `rotStdDev`. They tell the pose estimator how much to trust wheel odometry, in meters for X and Y and radians for rotation. Smaller numbers mean more trust.

```java
new OdometryStandardDevs(0.1, 0.1, 0.1)
```

`toMatrix()` returns the values as the 3×1 `Matrix<N3, N1>` that WPILib's pose estimator expects. The drivetrain configuration takes two of these, one for enabled and one for disabled, because the robot can be pushed around while disabled and its odometry should be trusted less then.
