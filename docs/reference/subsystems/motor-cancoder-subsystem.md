---
sidebar_position: 4
title: MotorCANCoderSubsystem
---

# MotorCANCoderSubsystem

`MotorCANCoderSubsystem` is a [`MotorSubsystem`](./motor-subsystem) paired with a CANcoder. Its purpose is to give a mechanism an absolute position at boot. On the first loop where the CANcoder reports a valid angle, the motor's relative encoder is set to match it, and from then on the motor's own encoder is used.

```java
import com.aembot.lib.subsystems.base.MotorCANCoderSubsystem;
```

It is abstract.

:::warning
Nothing in the codebase currently extends this class. It compiles and its logic is straightforward, but it has not been exercised on a robot. Read it before relying on it.
:::

## Type parameters

| Parameter | Bound                                   | Meaning                                  |
| --------- | --------------------------------------- | ---------------------------------------- |
| `MI`      | `extends MotorInputs`                   | Motor inputs.                            |
| `M`       | `extends MotorIO`                       | Motor IO.                                |
| `EI`      | `extends CANCoderInputs`                | CANcoder inputs.                         |
| `E`       | `extends CANCoderIO`                    | CANcoder IO.                             |
| `C`       | `extends MotorCANCoderConfiguration<?>` | Configuration for the motor and encoder. |

## Constructor

```java
public MotorCANCoderSubsystem(
    MI motorInputs, M motor, EI canCoderInputs, E canCoder, C motorConfiguration)
```

The subsystem name passed to the base class is `"Subsystems/" + motorConfiguration.kConfigurationName + "/" + canCoder.getName()`.

:::warning
`AEMSubsystem` already prepends `Subsystems/` to the name it is given, so this produces log prefixes of the form `Subsystems/Subsystems/<config>/<coder>`. This looks like a bug.
:::

## Loop

`periodic()` calls the base version, then reads the CANcoder inputs and logs them under `Inputs/Subsystems/<name>/Inputs`, the same path the motor inputs use.

Then, if all three of the following are true, it sets the motor's encoder to the CANcoder's absolute position converted to mechanism units and marks the offset as set.

- `motorConfig.isFusedCANCoder` is false. A fused CANcoder is handled by the TalonFX itself and needs no help.
- `hasSetOffset` is false. This happens once.
- `canCoderInputs.absolutePositionRotations` is not `NaN`. The CANcoder has reported something.

## Methods

| Method                          | Access    | Description                                                                     |
| ------------------------------- | --------- | ------------------------------------------------------------------------------- |
| `updateOffsetImpl()`            | protected | Set the motor encoder from the CANcoder now.                                    |
| `updateCANCoderOffsetCommand()` | public    | `InstantCommand` that calls `updateOffsetImpl`. Does not require the subsystem. |

## MotorCANCoderConfiguration

`MotorCANCoderConfiguration<C>` in `lib/config/motors` extends [`MotorConfiguration<C>`](../config/motor-configuration) with three public fields. It has no builder methods of its own, so set the fields directly.

| Field                     | Type                       | Default                          | Description                                                                   |
| ------------------------- | -------------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| `canCoderConfiguration`   | `AEMCANCoderConfiguration` | empty `AEMCANCoderConfiguration` | The CANcoder's device and vendor config.                                      |
| `encoderToMotorGearRatio` | `Double`                   | `1.0`                            | Encoder rotations per motor rotation.                                         |
| `isFusedCANCoder`         | `boolean`                  | `false`                          | True if the TalonFX is configured to use the CANcoder as its feedback source. |

Two conversion helpers use the ratio.

| Method                               | Description                                                                            |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| `getEncoderRotationsToUnits(double)` | Encoder rotations to mechanism units.                                                  |
| `getUnitsToEncoderRotations(double)` | Mechanism units to encoder rotations. Carries a source comment saying it may be wrong. |

## AEMCANCoderConfiguration

`AEMCANCoderConfiguration` in `lib/config/encoders` pairs a `CANDeviceID` with a Phoenix `CANcoderConfiguration`.

| Method                                     | Default | Description                       |
| ------------------------------------------ | ------- | --------------------------------- |
| `withDevice(CANDeviceID device)`           | `null`  | Which CANcoder.                   |
| `withConfiguration(CANcoderConfiguration)` | `null`  | Vendor config applied at startup. |

The same class is used by the swerve module configuration for the steering encoders.

## CANCoderInputs

`CANCoderInputs` in `lib/core/encoders` is the inputs object.

| Field                        | Description                      |
| ---------------------------- | -------------------------------- |
| `absolutePositionRotations`  | Absolute angle, 0 to 1 rotation. |
| `velocityRotationsPerSecond` | Angular velocity.                |

Both are logged as `AbsolutePositionRotations` and `VelocityRotationsPerSecond`.
