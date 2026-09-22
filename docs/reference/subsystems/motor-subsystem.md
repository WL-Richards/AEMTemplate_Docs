---
sidebar_position: 2
title: MotorSubsystem
---

# MotorSubsystem

`MotorSubsystem` is the base class for any mechanism driven by one motor. It owns a `MotorIO`, reads its inputs every loop, logs them, and provides a command for every way the motor can be controlled. Most subsystems in the library extend it and add very little.

```java
import com.aembot.lib.subsystems.base.MotorSubsystem;
```

It is abstract, generic over three types, and extends [`AEMSubsystem`](./aem-subsystem).

## Type parameters

| Parameter | Bound                           | Meaning                                                          |
| --------- | ------------------------------- | ---------------------------------------------------------------- |
| `I`       | `extends MotorInputs`           | The inputs object the motor fills each loop.                     |
| `M`       | `extends MotorIO`               | The IO the subsystem drives.                                     |
| `C`       | `extends MotorConfiguration<?>` | The [motor configuration](../config/motor-configuration) in use. |

A subsystem with nothing special about its motor uses `MotorSubsystem<MotorInputs, MotorIO, MotorConfiguration<TalonFXConfiguration>>`.

## Constructors

```java
public MotorSubsystem(String name, I motorInputs, M motor, C motorConfiguration)
public MotorSubsystem(I motorInputs, M motor, C motorConfiguration)
```

The second form uses `motorConfiguration.kConfigurationName` as the subsystem name. Both store the three arguments in the protected fields `inputs`, `io`, and `motorConfig`, then set a default command.

```java
setDefaultCommand(
    dutyCycleCommand(() -> 0.0)
        .withName("DefaultNeutral")
        .ignoringDisable(true)); // runs while the robot is disabled too
```

A motor subsystem therefore outputs zero whenever nothing else is scheduled on it, without any setup in `RobotContainer`. Override the default only when the mechanism should do something else at rest, such as a flywheel idling.

## Fields

| Field                     | Type      | Description                                                             |
| ------------------------- | --------- | ----------------------------------------------------------------------- |
| `io`                      | `M`       | The motor. All control goes through it.                                 |
| `inputs`                  | `I`       | Filled by `io.updateInputs` every loop.                                 |
| `motorConfig`             | `C`       | Configuration passed to the constructor.                                |
| `currentPositionSetpoint` | `double`  | Last position setpoint sent, in mechanism units. Starts at 0.           |
| `currentVelocitySetpoint` | `double`  | Last velocity setpoint sent, in units per second. Starts at 0.          |
| `motorEnabled`            | `boolean` | When false, every control call outputs zero volts instead. Starts true. |

All fields are protected. `motorEnabled` is the one subclasses tend to write to, usually from a dashboard toggle, so a mechanism can be disabled in the pit without redeploying. When it is false the setpoint is still logged, so the log shows what the motor would have been told.

## Loop

```java
@Override
public void periodic() {
  io.updateInputs(inputs);
  updateLog();
}

@Override
public void updateLog(String standardPrefix, String inputPrefix) {
  Logger.processInputs(inputPrefix + "/Inputs", inputs);
  AEMLogger.recordOutput(standardPrefix + "/CurrentCommand", ...); // "NONE" if idle
}
```

Inputs are logged under `Inputs/Subsystems/<name>/Inputs`. The name of the running command is logged under `Subsystems/<name>/CurrentCommand`. A subclass that overrides `periodic()` must call `super.periodic()` first so `inputs` is current before anything reads it.

## Encoder methods

All positions and velocities are in the mechanism units defined by the motor configuration. Conversion to rotor rotations happens inside the IO.

| Method                                | Access    | Description                                               |
| ------------------------------------- | --------- | --------------------------------------------------------- |
| `getCurrentPosition()`                | public    | `inputs.positionUnits`.                                   |
| `getCurrentVelocity()`                | public    | `inputs.velocityUnitsPerSecond`.                          |
| `getPositionSetpointUnits()`          | public    | `currentPositionSetpoint`.                                |
| `setEncoderPosition(double position)` | protected | Tell the motor its encoder currently reads this position. |
| `zeroEncoderPosition()`               | protected | Same as `setEncoderPosition(0)`.                          |

`setEncoderPosition` is the usual way to seed a mechanism that boots against a hard stop.

## Control implementations

Every command below calls one of these protected `...Impl` methods. They log the value under `Subsystems/<name>/Set<Kind>`, check `motorEnabled`, and forward to the IO. Subclasses can call them directly when writing a custom command, but should prefer the command factories.

| Method                                             | IO call                           |
| -------------------------------------------------- | --------------------------------- |
| `setOpenLoopDutyCycleImpl(double)`                 | `setOpenLoopDutyCycle`            |
| `setVoltageImpl(double)`                           | `setVoltageOutput`                |
| `setTorqueCurrentImpl(double)`                     | `setTorqueCurrent`                |
| `setPIDVelocitySetpointImpl(double, [int slot])`   | `setPIDVelocitySetpoint`          |
| `setPIDPositionSetpointImpl(double, [int slot])`   | `setPIDPositionSetpoint`          |
| `setSmartPositionSetpointImpl(double, [int slot])` | `setSmartPositionSetpoint`        |
| `setDynamicSmartPositionSetpointImpl(...)`         | `setDynamicSmartPositionSetpoint` |
| `setSmartVelocitySetpointImpl(double, [int slot])` | `setSmartVelocitySetpoint`        |
| `setSmartMotionConfigImpl(MotionMagicConfigs)`     | `setSmartMotorConfig`             |
| `setNeutralModeImpl(MotorIO.NeutralMode)`          | `setNeutralMode`                  |

## Commands

"Smart" in a method name means Motion Magic, the TalonFX's on-device motion profiling. "PID" means a plain closed loop with no profile. The `slot` argument selects which of the TalonFX's gain slots to use and defaults to 0 when omitted.

Every command takes suppliers rather than values so the setpoint is re-read each loop. Commands built with `runEnd` require the subsystem and run until interrupted unless the table says otherwise. Commands built with `InstantCommand` finish immediately.

### Duty cycle

| Method                                            | On the TalonFX | Ends when                                     |
| ------------------------------------------------- | -------------- | --------------------------------------------- |
| `dutyCycleCommand(DoubleSupplier dutyCycle)`      | `DutyCycleOut` | Interrupted. Sets 0 on end.                   |
| `dutyCycleCommandNoEnd(DoubleSupplier dutyCycle)` | `DutyCycleOut` | Interrupted. Leaves the last output in place. |

Duty cycle is a fraction of battery voltage from -1 to 1. It is the default neutral command and rarely used for anything else.

### Voltage and torque

| Method                                         | On the TalonFX     | Ends when                   |
| ---------------------------------------------- | ------------------ | --------------------------- |
| `voltageCommand(DoubleSupplier voltage)`       | `VoltageOut`       | Interrupted. Sets 0 on end. |
| `torqueCurrentCommand(DoubleSupplier current)` | `TorqueCurrentFOC` | Interrupted. Sets 0 on end. |

Voltage is the usual choice for open loop control, since it does not sag with the battery.

### Velocity

| Method                                                              | On the TalonFX               | Ends when    |
| ------------------------------------------------------------------- | ---------------------------- | ------------ |
| `velocitySetpointCommand(DoubleSupplier velocity)`                  | `VelocityVoltage`, slot 0    | Interrupted. |
| `smartVelocitySetpointCommand(DoubleSupplier velocity, [int slot])` | `MotionMagicVelocityVoltage` | Interrupted. |

Neither sets the output to zero on end. The motor keeps its last request until something else replaces it, which in practice is the default command.

The smart version ramps to the target at the acceleration in the Motion Magic config rather than jumping. Flywheels use it.

### PID position

| Method                                                                                                      | On the TalonFX    | Ends when                                             |
| ----------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------------------------------- |
| `positionSetpointCommand(DoubleSupplier position, int slot)`                                                | `PositionVoltage` | Interrupted.                                          |
| `positionSetpointUntilOnTargetCommand(DoubleSupplier position, DoubleSupplier acceptableError, [int slot])` | `PositionVoltage` | Position is within `acceptableError` of the setpoint. |

Note that the plain form has no overload without `slot`. The target is clamped to the configuration's min and max position before it reaches the device.

### Smart position

| Method                                                                                                           | On the TalonFX       | Ends when                                             |
| ---------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------- |
| `smartPositionSetpointCommand(DoubleSupplier position, [int slot])`                                              | `MotionMagicVoltage` | Interrupted.                                          |
| `smartPositionSetpointUntilOnTargetCommand(DoubleSupplier position, DoubleSupplier acceptableError, [int slot])` | `MotionMagicVoltage` | Position is within `acceptableError` of the setpoint. |

This is the default choice for anything that moves to a position. The cruise velocity and acceleration come from the Motion Magic section of the motor configuration.

### Dynamic smart position

| Method                                                                                                                                                       | On the TalonFX              | Ends when                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | ----------------------------------------------------- |
| `dynamicSmartPositionSetpointCommand(DoubleSupplier position, Supplier<MotionMagicConfigs> config, [int slot])`                                              | `DynamicMotionMagicVoltage` | Interrupted.                                          |
| `dynamicSmartPositionSetpointUntilOnTargetCommand(DoubleSupplier position, DoubleSupplier acceptableError, Supplier<MotionMagicConfigs> config, [int slot])` | `DynamicMotionMagicVoltage` | Position is within `acceptableError` of the setpoint. |

Same as smart position, but the cruise velocity, acceleration, and jerk are read from the supplied `MotionMagicConfigs` every loop instead of from the device's stored config. Use it when a mechanism needs to move at different speeds in different situations without rewriting the config.

### Motor config

| Method                                                | Requires subsystem | Ends when    |
| ----------------------------------------------------- | ------------------ | ------------ |
| `smartMotionConfigCommand(MotionMagicConfigs config)` | No                 | Immediately. |

Writes a new Motion Magic config to the device. It deliberately does not require the subsystem, so it can run alongside whatever command is active.

### Neutral mode

| Method              | Requires subsystem | Ends when    |
| ------------------- | ------------------ | ------------ |
| `setCoastCommand()` | Yes                | Immediately. |
| `setBrakeCommand()` | Yes                | Immediately. |

Both log the new mode under `Subsystems/<name>/SetNeutralMode`. Useful for letting a mechanism be moved by hand in the pit.

### Software limits

| Method                                                  | Requires subsystem               | Ends when                            |
| ------------------------------------------------------- | -------------------------------- | ------------------------------------ |
| `withoutSoftwareLimitsTemporailyCommand()`              | No                               | Interrupted. Restores limits on end. |
| `runWithoutSoftwareLimitsCommand(Command commandToRun)` | Whatever `commandToRun` requires | When `commandToRun` ends.            |

The first disables the device's soft limits when it starts and puts back whatever they were when it ends. The second wraps a command in it using a deadline group, so the limits are off for exactly as long as that command runs. Zeroing routines that drive into a hard stop use this.

:::info
`withoutSoftwareLimitsTemporailyCommand` is spelled that way in the source. The typo is part of the method name.
:::

## Extending it

A minimal subclass passes its configuration up and adds named commands.

```java
public class ClimberSubsystem
    extends MotorSubsystem<MotorInputs, MotorIO, MotorConfiguration<TalonFXConfiguration>> {

  public ClimberSubsystem(TalonFXClimberConfiguration config, ClimberIO io) {
    super(config.kName, new MotorInputs(), io.getMotor(), config.kMotorConfig);
  }

  public Command goToAngleCommand(double degrees) {
    return smartPositionSetpointCommand(() -> degrees).withName("ClimberGoTo" + degrees);
  }
}
```

The [Creating a Subsystem](../../tutorials/getting-started-aemlib/creating-a-subsystem) tutorial walks through the full set of files around this.
