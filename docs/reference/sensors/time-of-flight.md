---
sidebar_position: 1
title: Time of Flight
---

# Time of Flight

A time of flight sensor measures distance to the nearest object in front of it. The library wraps one as a `TimeOfFlightSensor` with the usual inputs and IO split, and adds hysteresis based object detection on top. The only hardware implementation is for the CTRE CANrange.

```java
import com.aembot.lib.core.sensors.timeOfFlight.TimeOfFlightSensor;
import com.aembot.lib.config.sensors.timeOfFlight.CANRangeTimeOfFlightConfiguration;
```

A sensor is not a subsystem. It is owned by one and updated from that subsystem's `periodic`.

## TimeOfFlightConfiguration

The base configuration. `CANRangeTimeOfFlightConfiguration` extends it for the CANrange.

| Method                                   | Default | Description                                                                   |
| ---------------------------------------- | ------- | ----------------------------------------------------------------------------- |
| `TimeOfFlightConfiguration(String name)` |         | Name used in log prefixes.                                                    |
| `withCANDeviceID(CANDeviceID)`           | `null`  | The device. Required for CAN sensors.                                         |
| `withDetectionThresholdMeters(double)`   | `-1`    | Distance under which an object counts as present. `-1` disables detection.    |
| `withDetectionHysteresisMeters(double)`  | `0.01`  | Band around the threshold to stop the detected flag from flickering.          |
| `validate()`                             |         | Chainable. Documented as the required final call, but currently does nothing. |

With a threshold of 0.1 and hysteresis of 0.01, an object is detected once it is closer than 0.09 and stays detected until it is farther than 0.11.

### CANRangeTimeOfFlightConfiguration

Adds the CTRE configuration object and a few shortcuts into it.

| Method                                  | Description                                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------- |
| `withCTREConfig(CANrangeConfiguration)` | Replace the whole CTRE config. Call this first if at all, since it overwrites the rest. |
| `withFOVConfig(FovParamsConfigs)`       | Field of view settings.                                                                 |
| `withUpdateMode(UpdateModeValue)`       | Short range or long range mode.                                                         |
| `withUpdateFrequencyHz(double)`         | Measurement rate.                                                                       |

The threshold and hysteresis setters are overridden to also write CTRE's proximity parameters. The library does its own detection and ignores CTRE's, but setting both means Phoenix Tuner shows a matching value.

```java
CANRangeTimeOfFlightConfiguration config =
    new CANRangeTimeOfFlightConfiguration("IndexerSensor")
        .withCANDeviceID(new CANDeviceID(30, "IndexerSensor", "Indexer", CANDeviceType.CANRANGE))
        .withDetectionThresholdMeters(0.1)
        .withDetectionHysteresisMeters(0.01)
        .withUpdateFrequencyHz(100)
        .validate();
```

## TimeOfFlightInputs

| Field                  | Default | Description                                                         |
| ---------------------- | ------- | ------------------------------------------------------------------- |
| `distanceMeters`       | `NaN`   | Latest measurement.                                                 |
| `distanceStdDevMeters` | `-1.0`  | Reported standard deviation. `-1.0` if the IO does not provide one. |

## TimeOfFlightIO

| Method                             | Description                               |
| ---------------------------------- | ----------------------------------------- |
| `updateInputs(TimeOfFlightInputs)` | Fill the inputs from hardware.            |
| `getConfig()`                      | The configuration this IO was built with. |

`TimeOfFlightSimIO` extends it with `setSimulatedDistance(double)`.

| Implementation              | Environment | Notes                                                                                                                                                                                                                              |
| --------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TimeOfFlightIOCANRange`    | Real        | Creates the `CANrange`, sets the distance and standard deviation signals to 100 Hz, optimizes bus usage, registers with `CANStatusLogger`. Applies the CTRE config only if constructed with a `CANRangeTimeOfFlightConfiguration`. |
| `TimeOfFlightSimIOCanRange` | Sim         | The real IO plus CTRE's `CANrangeSimState`. Logs the simulated distance.                                                                                                                                                           |
| `TimeOfFlightIOReplay`      | Replay      | Does nothing.                                                                                                                                                                                                                      |

`TimeOfFlightIOCANRange` ignores a measurement of exactly zero and keeps the previous inputs. The comment says this patches a simulation issue where the sim state reports zero before it has been set.

:::info
The real IO has two constructors. The one taking the base `TimeOfFlightConfiguration` sets up signals but never writes a configuration to the device. Pass a `CANRangeTimeOfFlightConfiguration` to get the config applied.
:::

## TimeOfFlightSensor

The wrapper that a subsystem holds. It owns the inputs, runs detection, and logs.

| Constructor                                                                        | Description                                                                |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `TimeOfFlightSensor(TimeOfFlightIO io, String standardPrefix, String inputPrefix)` | Takes the parent subsystem's prefixes and appends the sensor name to each. |

| Method                         | Description                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `update()`                     | Refresh inputs, log them, run detection, log the detected flag. Call every loop. |
| `getDistanceMeters()`          | Latest distance.                                                                 |
| `getDistanceStdDevMeters()`    | Latest standard deviation.                                                       |
| `getObjectDetected()`          | Result of the threshold and hysteresis check.                                    |
| `setSimulatedDistance(double)` | Forward to the IO if it is a sim IO. No-op otherwise.                            |

Detection only runs if the threshold is greater than zero. The detected flag is logged at `<standardPrefix>/<name>/ObjectDetected` and the inputs at `<inputPrefix>/<name>`.

```java
// In a subsystem constructor
sensor = new TimeOfFlightSensor(io, logPrefixStandard, logPrefixInput);

// In periodic, after super.periodic()
sensor.update();
if (sensor.getObjectDetected()) { ... }
```

:::tip
Unlike a subsystem, `update()` is not called for you. Forgetting it means the inputs stay at their defaults and `getObjectDetected` is always `false`.
:::
