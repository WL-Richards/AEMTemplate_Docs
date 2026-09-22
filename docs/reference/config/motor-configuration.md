---
sidebar_position: 1
title: Motor Configuration
---

# Motor Configuration

`MotorConfiguration<T>` describes a single motor in terms of the units the mechanism cares about, rather than rotor rotations. It wraps a vendor configuration object (the type parameter `T`, usually `TalonFXConfiguration`), pairs it with a CAN ID, and adds the conversion ratios and soft limits that the motor IO layer needs.

```java
import com.aembot.lib.config.motors.MotorConfiguration;
```

Every subsystem configuration that drives a motor takes one of these, either directly or through a `SimulatedMotorConfiguration`.

## Units

The library never asks for a gear ratio directly. Instead, two ratios describe how the mechanism's units relate to rotations.

| Ratio                           | Meaning                                                  |
| ------------------------------- | -------------------------------------------------------- |
| `kUnitToRotorRotationRatio`     | Units of travel per one rotation of the motor's rotor    |
| `kUnitToMechanismRotationRatio` | Units of travel per one rotation of the mechanism output |

The gear ratio is derived from the two, so `getGearRatio()` returns mechanism ratio divided by rotor ratio.

For an arm measured in degrees with a 50:1 reduction, the mechanism ratio is 360 and the rotor ratio is 360 / 50 = 7.2. For a flywheel measured in meters per second of surface speed, both ratios are the wheel circumference divided by the reduction on that side.

:::info
The default mechanism ratio is 360. If a mechanism is measured in something other than degrees, set both ratios explicitly.
:::

## Builder methods

All methods return the configuration itself so calls can be chained.

| Method                                     | Default                    | Description                                               |
| ------------------------------------------ | -------------------------- | --------------------------------------------------------- |
| `withMotorConfig(T config)`                | `null`                     | Vendor configuration applied to the controller. Required. |
| `withCANDevice(CANDeviceID device)`        | `null`                     | CAN ID, bus, and name of the motor controller. Required.  |
| `withName(String name)`                    | `"UNNAMED"`                | Name used in logs.                                        |
| `withUnitToRotorRotationRatio(double)`     | `1.0`                      | See [Units](#units).                                      |
| `withUnitToMechanismRotationRatio(double)` | `360`                      | See [Units](#units).                                      |
| `withMinPositionUnits(double)`             | `Double.NEGATIVE_INFINITY` | Lower soft limit in mechanism units.                      |
| `withMaxPositionUnits(double)`             | `Double.POSITIVE_INFINITY` | Upper soft limit in mechanism units.                      |
| `withMomentOfInertia(double)`              | `0.05`                     | Moment of inertia in kg·m². Used by simulation only.      |

## Conversion helpers

These read the ratios above and are used throughout the motor IO classes. They are also handy in configuration files when a Motion Magic value needs to be expressed in rotor rotations.

| Method                                 | Converts                      |
| -------------------------------------- | ----------------------------- |
| `getRotorRotationsToUnits(double)`     | Rotor rotations → units       |
| `getUnitsToRotorRotations(double)`     | Units → rotor rotations       |
| `getMechanismRotationsToUnits(double)` | Mechanism rotations → units   |
| `getUnitsToMechanismRotations(double)` | Units → mechanism rotations   |
| `getGearRatio()`                       | Returns the derived reduction |

## Example

A flywheel measured in meters per second of surface speed, direct driven by a Kraken X60 on CAN ID 54.

```java
double wheelCircumference = 2.0 * Math.PI * Units.inchesToMeters(2.0); // meters per rotation of a 4 in wheel

MotorConfiguration<TalonFXConfiguration> config =
    new MotorConfiguration<TalonFXConfiguration>()
        .withMotorConfig(                                            // vendor config, applied directly to the TalonFX
            new TalonFXConfiguration()
                .withMotorOutput(
                    new MotorOutputConfigs().withNeutralMode(NeutralModeValue.Coast)) // spin down freely at zero output
                .withCurrentLimits(
                    new CurrentLimitsConfigs()
                        .withSupplyCurrentLimit(60.0)                // cap battery current at 60 A
                        .withSupplyCurrentLimitEnable(true))
                .withSlot0(new ConfigureSlot0Gains(0.0, 0.0, 0.0, 0.0, 0.4, 0.132, 0.0))) // kP, kI, kD, kG, kS, kV, kA
        .withCANDevice(
            new CANDeviceID(54, "FlywheelMotor", "FlywheelSubsystem", CANDeviceType.TALON_FX)) // ID 54 on the rio bus
        .withName("FlywheelSubsystemMotor")                          // name shown in the log
        .withUnitToRotorRotationRatio(wheelCircumference)            // one rotor turn moves one circumference (direct drive)
        .withUnitToMechanismRotationRatio(wheelCircumference)        // same for the mechanism, so gear ratio is 1
        .withMomentOfInertia(0.01);                                  // kg·m², used only in simulation
```

:::tip
`ConfigureSlot0Gains` is a thin wrapper around `Slot0Configs` that takes all seven gains in one constructor call. The order is kP, kI, kD, kG, kS, kV, kA.
:::

## Simulation

`SimulatedMotorConfiguration<T>` wraps a real configuration with the extra details a sim needs.

| Method                                         | Description                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| `withRealConfiguration(MotorConfiguration<T>)` | The configuration above. Ratios and moment of inertia are read from it. |
| `withSimMotorConstants(DCMotor)`               | Motor model, for example `DCMotor.getKrakenX60(1)`.                     |
| `withStartingRotation(double)`                 | Initial position in mechanism units.                                    |

```java
SimulatedMotorConfiguration<TalonFXConfiguration> simConfig =
    new SimulatedMotorConfiguration<TalonFXConfiguration>()
        .withRealConfiguration(config)                       // reuse ratios, limits, and inertia from the real config
        .withStartingRotation(0)                             // starting position in mechanism units
        .withSimMotorConstants(DCMotor.getKrakenX60(1));     // physics model for one Kraken X60
```

Subsystem configurations usually take both. The subsystem factory picks the real one on the robot and the simulated one on a desktop.
