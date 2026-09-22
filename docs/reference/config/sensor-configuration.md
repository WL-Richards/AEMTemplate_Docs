---
sidebar_position: 9
title: Sensor Configuration
---

# Sensor Configuration

Configuration classes for the CAN sensors that sit alongside motors: time of flight distance sensors and CANcoders.

```java
import com.aembot.lib.config.sensors.timeOfFlight.TimeOfFlightConfiguration;
import com.aembot.lib.config.sensors.timeOfFlight.CANRangeTimeOfFlightConfiguration;
import com.aembot.lib.config.encoders.AEMCANCoderConfiguration;
import com.aembot.lib.config.motors.MotorCANCoderConfiguration;
```

## TimeOfFlightConfiguration

`TimeOfFlightConfiguration` is the base for any distance sensor used as a game piece detector. It describes the sensor's CAN device and the distance at which something counts as detected. The constructor takes a name.

| Method                                  | Default | Description                                                                      |
| --------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `withCANDeviceID(CANDeviceID)`          | `null`  | The sensor's CAN ID and bus.                                                     |
| `withDetectionThresholdMeters(double)`  | `-1`    | An object closer than this is detected. Required. The default will never detect. |
| `withDetectionHysteresisMeters(double)` | `0.01`  | Dead band around the threshold. See below.                                       |
| `validate()`                            |         | Present for consistency with other configs. Currently checks nothing.            |

Fields: `kName`, `kCANDeviceID`, `kDetectionThresholdMeters`, `kDetectionHysteresisMeters`.

### Hysteresis

Without hysteresis an object sitting right at the threshold flickers between detected and not. With a threshold of 0.1 m and a hysteresis of 0.01 m, an object has to come within 0.09 m to become detected, and then has to move past 0.11 m to become undetected again.

## CANRangeTimeOfFlightConfiguration

`CANRangeTimeOfFlightConfiguration` extends the base for a CTRE CANrange. It carries a `CANrangeConfiguration` in the public `kCTREConfig` field and adds methods for the CANrange's own settings. The base class methods are overridden to return this type, so the chain keeps working.

| Method                                  | Description                                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `withUpdateMode(UpdateModeValue)`       | Short range or long range, at various rates. A CTRE enum.                               |
| `withUpdateFrequencyHz(double)`         | How often the sensor measures. Lower is steadier, higher is faster.                     |
| `withFOVConfig(FovParamsConfigs)`       | Field of view of the sensor. A CTRE config object.                                      |
| `withCTREConfig(CANrangeConfiguration)` | Replace the whole CTRE config. Call this first if at all, since it discards the others. |

The threshold and hysteresis overrides also write the value into the CTRE config's proximity settings. The library does its own detection from the raw distance and does not use CTRE's, but having the numbers on the device makes Phoenix Tuner's readout match.

```java
new CANRangeTimeOfFlightConfiguration("IndexerSensor")
    .withCANDeviceID(new CANDeviceID(40, "IndexerSensor", "IndexerSubsystem", CANDeviceType.CANRANGE))
    .withDetectionThresholdMeters(0.08)
    .withDetectionHysteresisMeters(0.01)
    .withUpdateMode(UpdateModeValue.ShortRange100Hz)
    .validate();
```

## AEMCANCoderConfiguration

`AEMCANCoderConfiguration` pairs a CANcoder's CAN device with its CTRE `CANcoderConfiguration`. It has no constructor arguments and two builder methods.

| Method                                     | Default | Description                          |
| ------------------------------------------ | ------- | ------------------------------------ |
| `withDevice(CANDeviceID)`                  | `null`  | The CANcoder's CAN ID and bus.       |
| `withConfiguration(CANcoderConfiguration)` | `null`  | Magnet offset, direction, and range. |

Fields: `device`, `configuration`. Neither has a `k` prefix.

## MotorCANCoderConfiguration

`MotorCANCoderConfiguration<C>` is a `MotorConfiguration<C>` for a motor that has a CANcoder attached. It adds the encoder's configuration and the ratio between them. Everything from [Motor Configuration](./motor-configuration) applies.

| Field                     | Default                          | Description                                                                   |
| ------------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| `canCoderConfiguration`   | `new AEMCANCoderConfiguration()` | The attached CANcoder.                                                        |
| `encoderToMotorGearRatio` | `1.0`                            | Encoder rotations per motor rotation.                                         |
| `isFusedCANCoder`         | `false`                          | Whether the TalonFX is configured to fuse the CANcoder into its own feedback. |

There are no builder methods for these three fields. Set them directly after construction.

```java
MotorCANCoderConfiguration<TalonFXConfiguration> config =
    new MotorCANCoderConfiguration<TalonFXConfiguration>();
config.withMotorConfig(talonConfig).withCANDevice(motorID); // inherited builders
config.canCoderConfiguration = new AEMCANCoderConfiguration().withDevice(encoderID);
config.encoderToMotorGearRatio = 1.0;
config.isFusedCANCoder = true;
```

:::warning
The inherited `with` methods return `MotorConfiguration<C>`, not `MotorCANCoderConfiguration<C>`. Assign the object to a variable of the subclass type before chaining, or the result of the chain will be the wrong type.
:::

Two conversion helpers are added on top of the motor ones.

| Method                               | Converts                                              |
| ------------------------------------ | ----------------------------------------------------- |
| `getEncoderRotationsToUnits(double)` | Encoder rotations to units, through the encoder ratio |
| `getUnitsToEncoderRotations(double)` | Units to encoder rotations                            |

The second one carries a comment in the source saying it may be wrong. Check its output against a known position before relying on it.
