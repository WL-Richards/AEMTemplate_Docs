---
sidebar_position: 9
title: Intake Subsystems
---

# Intake Subsystems

An over the bumper intake is two mechanisms: a deploy arm that swings out past the bumper, and rollers that pull game pieces in. The library provides a subsystem for each, and two variants of the roller subsystem depending on how many motors drive it.

```java
import com.aembot.lib.subsystems.intake.over_bumper.deploy.OverBumperIntakeDeploySubsystem;
import com.aembot.lib.subsystems.intake.generic.run.IntakeRollerSubsystem;
import com.aembot.lib.subsystems.intake.generic.multimotor.IntakeRollerMultiMotorSubsystem;
```

All three publish into a state object through a `Consumer` or a shared reference rather than owning it, so `RobotState` can hold the single copy.

## OverBumperIntakeDeploySubsystem

A single motor arm measured in degrees. Extends `MotorSubsystem`. Configured with a [`TalonFXOverBumperIntakeDeployConfiguration`](../config/intake-configuration).

```java
new OverBumperIntakeDeploySubsystem(
    TalonFXOverBumperIntakeDeployConfiguration config,
    OverBumperIntakeDeployIO io,
    Consumer<OverBumperIntakeDeployState> stateConsumer)
```

The constructor sets the encoder to `config.kInitialAngleDeg`.

### Positions

The up and down positions are not separate configuration fields. They are the soft limits on the motor configuration.

| Position | Source                               |
| -------- | ------------------------------------ |
| Up       | `kRealMotorConfig.kMaxPositionUnits` |
| Down     | `kRealMotorConfig.kMinPositionUnits` |

`isDeployed` in the state is true when the position is below the midpoint of the two.

### Commands

| Command                    | Behavior                                                       |
| -------------------------- | -------------------------------------------------------------- |
| `putIntakeUpCommand()`     | Motion Magic to the up position.                               |
| `putIntakeDownCommand()`   | Motion Magic to the down position.                             |
| `flickIntakeCommand()`     | Up for 0.35 s, then down until within 2 units of the setpoint. |
| `getZeroUpwardCommand()`   | Drive up into the hard stop and reset the encoder. See below.  |
| `getZeroDownwardCommand()` | Drive down into the hard stop and reset the encoder.           |

### Zeroing

The deploy arm has no absolute encoder, so it finds its position by driving into a hard stop. Both zeroing commands follow the same shape.

1. Set the encoder to the far soft limit, so the soft limit on the other side cannot stop the motion early. Restart a timer.
2. Apply `kZeroingVoltage` toward the hard stop until velocity is within 0.5 units per second of zero and the timer has passed a minimum. Upward waits 0.1 s, downward waits 0.5 s.
3. In `finallyDo`, set the encoder to the known hard stop angle, `kUpwardsZeroAngleDeg` or `kDownwardsZeroAngleDeg`.

:::warning
Step 3 passes `config.kRealMotorConfig.getUnitsToRotorRotations(angle)` to `setEncoderPosition`. That method already takes mechanism units and converts to rotor rotations inside the IO, so the angle is converted twice. The encoder ends up at the zero angle divided by the gear ratio, not the zero angle. Pass the angle directly.
:::

### OverBumperIntakeDeployState

| Field                 | Meaning                                |
| --------------------- | -------------------------------------- |
| `deployPositionUnits` | Current angle.                         |
| `isDeployed`          | Below the midpoint of the soft limits. |

Logged as `deployPosition ` and `isDeployed`. The first key has a trailing space.

### IO

`OverBumperIntakeDeployIO` has `getMotor()` and `updateInputs(OverBumperIntakeDeployInputs)`. The inputs class is empty.

| Implementation                            | Motor               |
| ----------------------------------------- | ------------------- |
| `TalonFXOverBumperIntakeDeployHardwareIO` | `MotorIOTalonFX`    |
| `OverBumperIntakeDeploySimIO`             | `MotorIOTalonFXSim` |
| `OverBumperIntakeDeployReplayIO`          | `MotorIOReplay`     |

## IntakeRollerSubsystem

A single motor roller. Extends `MotorSubsystem`. Configured with a `TalonFXIntakeRollerConfiguration`.

```java
new IntakeRollerSubsystem(
    TalonFXIntakeRollerConfiguration config,
    IntakeRollerIO io,
    Consumer<IntakeRollerState> stateConsumer)
```

| Command               | Behavior                            |
| --------------------- | ----------------------------------- |
| `runRollerCommand()`  | Voltage at `config.kIntakeVoltage`. |
| `stopRollerCommand()` | Zero voltage.                       |

Each loop the subsystem writes velocity into the state and sets `isActive` when velocity exceeds one mechanism rotation's worth of units. The state consumer is called every loop.

The IO interface, inputs, and three implementations mirror the deploy subsystem's exactly, with `IntakeRoller` in the names.

## IntakeRollerMultiMotorSubsystem

The same roller behavior for a leader with followers. Extends `MotorFollowerSubsystem` instead of `MotorSubsystem`. Configured with a `BinaryVoltageMotorFollowerConfig`, which holds a `MotorFollowersConfiguration` and a single `kRunVoltage`.

```java
new IntakeRollerMultiMotorSubsystem(
    BinaryVoltageMotorFollowerConfig config,
    IntakeRollerState state,
    CompoundMotorIO<MotorIO> motorIOContainer)
```

There is no IO interface of its own. The subsystem takes a `CompoundMotorIO`, which bundles the leader and follower `MotorIO`s for a given runtime mode. See [Motor Follower Subsystem](./motor-follower-subsystem).

| Command                  | Behavior                   |
| ------------------------ | -------------------------- |
| `runRollerCommand()`     | Voltage at `kRunVoltage`.  |
| `reverseRollerCommand()` | Voltage at `-kRunVoltage`. |
| `stopRollerCommand()`    | Zero voltage.              |

The state is passed in rather than a consumer, and written directly.

## IntakeRollerState

Shared by both roller subsystems.

| Field                        | Type                      | Meaning                                         |
| ---------------------------- | ------------------------- | ----------------------------------------------- |
| `angularVelocityUnitsPerMin` | `AtomicReference<Double>` | Roller velocity.                                |
| `isActive`                   | `AtomicBoolean`           | Velocity above one mechanism rotation of units. |

:::info
The field is named per minute but is set from `getCurrentVelocity()`, which is units per second.
:::

## SimulatedOverBumperIntakeState

Drives maple-sim's `IntakeSimulation` so a simulated robot actually picks up game pieces.

```java
new SimulatedOverBumperIntakeState(
    Supplier<OverBumperIntakeDeployState> deployState,
    IntakeRollerState rollerState,
    TalonFXOverBumperIntakeDeployConfiguration deployConfig)
```

| Method                                      | Description                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `setDriveSim(AbstractDriveTrainSimulation)` | Required once. Builds the intake sim from `kWidthMeters`, `kExtensionMeters`, and `kSide`. Throws if called twice. |
| `update()`                                  | Starts the sim intake while `isDeployed`, stops it otherwise. Call every loop.                                     |
| `pullGamePiece()`                           | Removes one held piece. Returns false if none.                                                                     |

Game pieces are only collected while `rollerState.isActive` is true, through a custom intake condition. `Initialized` and `HeldGamePieces` are logged.
