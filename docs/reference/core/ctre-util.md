---
sidebar_position: 4
title: CTRE Utilities
---

# CTRE Utilities

`CTREUtil` collects the retry logic and fault checking that every Phoenix 6 device interaction goes through. Its job is to make a configuration write or a signal setting either succeed or report a clear error, rather than fail silently. The class is adapted from Team 254's and Team 2910's public code.

```java
import com.aembot.lib.core.phoenix6.CTREUtil;
```

Everything in it is static. Configuration helpers are nested under `CTREUtil.Configuration.Motors`, `.Encoders`, and `.Sensors.TimeOfFlight`.

## Retrying

Phoenix 6 calls return a `StatusCode`. A call can fail if the bus is busy or the device is still booting, and a config write that fails is easy to miss. `tryUntilOk` is the fix.

| Method                                                                                   | Description                                                                                                                                                           |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tryUntilOk(Supplier<StatusCode> tryee, int deviceID, int maxRetryCount)`                | Call `tryee` until it returns `OK` or `maxRetryCount` attempts have been made. Reports an error to the Driver Station on final failure. Returns the last status code. |
| `setUpdateFrequencyForAll(double frequencyHz, BaseStatusSignal[] signals, int deviceID)` | Set the update rate of every signal in the array, with retries.                                                                                                       |
| `DEFAULT_MAX_RETRIES`                                                                    | `10`. Used by every helper below.                                                                                                                                     |

```java
CTREUtil.tryUntilOk(() -> motor.getConfigurator().apply(config), motor.getDeviceID(), 10);
```

The retries happen back to back with no delay between them. The error message includes the device ID so it can be matched to the CAN ID table.

:::info
`tryUntilOk` blocks until it succeeds or runs out of attempts. Every `applyConfiguration` below inherits that. Apply configurations at construction, not from inside a command.
:::

## Motor configuration

`CTREUtil.Configuration.Motors` applies configuration objects to a `TalonFX` with retries. Each method has an overload that takes a `MotorIOTalonFX` and unwraps it, so callers can pass either.

| Method                                                                  | Applies                                                                   |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `applyConfiguration(TalonFX, TalonFXConfiguration)`                     | The whole configuration.                                                  |
| `applyConfiguration(TalonFX, MotorConfiguration<TalonFXConfiguration>)` | The `TalonFXConfiguration` inside a `MotorConfiguration`.                 |
| `applyConfiguration(TalonFX, HardwareLimitSwitchConfigs)`               | Just the limit switch group.                                              |
| `applyConfiguration(TalonFX, MotionMagicConfigs)`                       | Just the Motion Magic group.                                              |
| `applyConfiguration(TalonFX, CurrentLimitsConfigs)`                     | Just the current limit group.                                             |
| `applyConfigurationNonBlocking(TalonFX, VoltageConfigs)`                | Just the voltage group, with a 10 ms timeout and no retry.                |
| `refreshConfiguration(TalonFX, TalonFXConfiguration)`                   | Read the device's current settings into the object. Retries.              |
| `getConfiguration(MotorIOTalonFX, TalonFXConfiguration)`                | `refreshConfiguration` for the IO overload.                               |
| `optimizeBusUtilization(TalonFX)`                                       | Disable every status signal that has not had an update rate set. Retries. |

Applying a partial group is faster than applying the whole configuration, which is why `MotorIOTalonFX.setSmartMotorConfig` sends only the `MotionMagicConfigs`. The non-blocking voltage variant exists because voltage config changes are sometimes made while running.

## Faults

A TalonFX and a CANcoder each keep a set of fault flags. Two helpers read them.

| Method                                              | Description                                                            |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| `Motors.checkFaults(TalonFX)`                       | Returns a `List<FaultState>` of every active fault.                    |
| `Motors.checkAndLogFaults(TalonFX, String name)`    | Reports the list to the Driver Station as an error if it is not empty. |
| `Encoders.checkFaults(CANcoder)`                    | Same for an encoder.                                                   |
| `Encoders.checkAndLogFaults(CANcoder, String name)` | Same for an encoder.                                                   |

Both `Motors` and `Encoders` define their own `FaultState` enum whose `toString()` returns the Phoenix 6 fault name. The motor enum covers twenty faults, from hardware and supply voltage problems through current limits, remote sensor errors, limit switches, and temperature. The encoder enum covers five, including `BAD_MAGNET`.

Nothing in the library calls these automatically. They are available for a diagnostic command or a pit check.

## Encoders and sensors

| Method                                                                                 | Description                                                      |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `Encoders.applyConfiguration(CANcoder, CANcoderConfiguration)`                         | Apply with retries.                                              |
| `Sensors.TimeOfFlight.applyConfiguration(CANrange, CANRangeTimeOfFlightConfiguration)` | Apply the `kCTREConfig` inside the library config, with retries. |
| `Sensors.TimeOfFlight.optimizeBusUtilization(CANrange)`                                | Same as the motor version, for a CANrange.                       |

## AEMSwerveDriveState

`AEMSwerveDriveState` is a small extension of CTRE's `SwerveDriveState` in the same package. CTRE timestamps its drive state on its own clock, which is not the roboRIO's. This class adds one field so the two can be reconciled.

```java
import com.aembot.lib.core.phoenix6.AEMSwerveDriveState;
```

| Member                                         | Description                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `timestampRIOSynchronized`                     | The state's timestamp converted to the roboRIO clock. Defaults to `NaN`.                          |
| `fromSwerveDriveState(SwerveDriveState state)` | Static. Copies every field from a CTRE state into a new instance. Does not set the RIO timestamp. |
| `clone()`                                      | Deep copy including the RIO timestamp.                                                            |

`DrivetrainHardwareIO` builds one from every CTRE telemetry callback and fills in the RIO timestamp. `DrivetrainInputs` extends it, so the drivetrain's logged inputs are a swerve drive state with a usable timestamp.

## Where it is used

`TalonFXFactory.createRawWithConfig` and every configuration setter on `MotorIOTalonFX` go through `Motors.applyConfiguration`. `MotorIOTalonFX`'s constructor uses `setUpdateFrequencyForAll` and `optimizeBusUtilization`. `CANCoderFactory` uses `Encoders.applyConfiguration`, and `TimeOfFlightIOCANRange` uses the `Sensors.TimeOfFlight` helpers.
