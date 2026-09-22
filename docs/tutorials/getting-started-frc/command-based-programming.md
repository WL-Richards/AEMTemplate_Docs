---
sidebar_position: 2
title: Command-Based Programming
---

# Command-Based Programming

WPILib's command-based framework is the structure that every part of this codebase follows. It splits robot code into two kinds of objects: subsystems, which own hardware, and commands, which use it. A scheduler runs in the background and decides which commands are active at any moment.

If you have not seen the framework before, the [WPILib documentation](https://docs.wpilib.org/en/stable/docs/software/commandbased/index.html) covers it in full. This page covers the parts that matter for reading and writing code here.

## Subsystems

A subsystem is a class that owns a mechanism. The flywheel, the hood, the drivetrain, and each intake are all subsystems. A subsystem is responsible for talking to its motors and sensors, and nothing else on the robot is allowed to touch that hardware directly.

Every subsystem has a `periodic()` method that the scheduler calls once per loop, 50 times a second. In this codebase, `periodic()` is where sensor values are read so the rest of the code can use them. Motor outputs are almost never set from `periodic()`. That is the job of commands.

```java
public class FlywheelSubsystem extends SubsystemBase {
  private final TalonFX motor = new TalonFX(54);
  private double velocity = 0.0;

  @Override
  public void periodic() {
    velocity = motor.getVelocity().getValueAsDouble(); // runs every loop
  }

  public double getVelocity() {
    return velocity;
  }
}
```

This is the plain WPILib shape. Subsystems in this repo extend a library base class, [`AEMSubsystem`](../../reference/subsystems/aem-subsystem), instead of `SubsystemBase` and read sensors through an extra layer, which is covered on the [IO Layers and Logging](./io-layers-and-logging) page. The idea is the same. To build one from scratch, see [Creating a Subsystem](../getting-started-aemlib/creating-a-subsystem).

:::info
A subsystem can only run one command at a time. This is the rule that makes the framework work. Two commands that both want the flywheel cannot both be running, so there is never a question of whose output wins.
:::

## Commands

A command is a unit of work that uses one or more subsystems. It has a beginning, a body that runs every loop, and an end condition. Commands declare which subsystems they require, and the scheduler uses that list to enforce the one command per subsystem rule.

Commands here are almost never written as classes. They are built from factory methods and combined using the operators on `Command`.

### Composing commands

Small commands are joined into bigger ones with a handful of operators. The ones that show up most often are listed below.

| Operator                      | Meaning                                                                   |
| ----------------------------- | ------------------------------------------------------------------------- |
| `a.andThen(b)`                | Run `a` to completion, then run `b`.                                      |
| `a.alongWith(b)`              | Run both at once. Ends when both have ended.                              |
| `a.raceWith(b)`               | Run both at once. Ends when either has ended.                             |
| `a.deadlineFor(b)`            | Run both at once. Ends when `a` ends, and cancels `b`.                    |
| `a.until(condition)`          | Run `a` until the condition is true.                                      |
| `a.withTimeout(seconds)`      | Run `a` for at most this long.                                            |
| `a.finallyDo(action)`         | Run `a`, then run the action when it ends for any reason.                 |
| `Commands.either(a, b, cond)` | Pick `a` or `b` at the moment the command starts, based on the condition. |
| `a.withName("Name")`          | Set the name shown in the log. Always do this for anything long lived.    |

## Default commands

Every subsystem can have a default command, which runs whenever nothing else needs that subsystem. `RobotContainer` sets these up right after the subsystems are created.

```java
hoodSubsystem.setDefaultCommand(commandFactory.shooterCommands.createHoodDownCommand());
flywheelSubsystem.setDefaultCommand(commandFactory.shooterCommands.createFlywheelIdleSpeedCommand());
```

The library's `MotorSubsystem` sets a default of zero duty cycle in its constructor, so a mechanism that is never given anything else to do will sit still. Overriding the default with something like a flywheel idle speed means the mechanism returns to a known state on its own whenever a command ends.

## The scheduler

`CommandScheduler` is a singleton that WPILib runs from `robotPeriodic()`. Each loop it does the following, in order.

1. Calls `periodic()` on every subsystem.
2. Polls every trigger and schedules any command a trigger asks for.
3. Runs one iteration of every scheduled command, and ends any whose `isFinished()` returned true.
4. Starts the default command of any subsystem that has nothing scheduled.

When a new command is scheduled that requires a subsystem another command is already using, the running command is interrupted and the new one takes over. This is what makes a button press feel immediate.

## Triggers

A `Trigger` wraps a boolean. Anything that can be expressed as true or false can be one: a controller button, a sensor reading, or a `DriverStation` state. Triggers have methods that schedule commands when the value changes.

| Method              | Runs the command...                                 |
| ------------------- | --------------------------------------------------- |
| `onTrue(cmd)`       | Once, when the trigger goes from false to true.     |
| `onFalse(cmd)`      | Once, when the trigger goes from true to false.     |
| `whileTrue(cmd)`    | While true. Cancels it when the trigger goes false. |
| `toggleOnTrue(cmd)` | Starts it on one press and cancels it on the next.  |

```java
driverController.rightTrigger().whileTrue(commandFactory.createShootFuelCommand());

driverController
    .leftTrigger()
    .onTrue(commandFactory.intakeCommands.createZeroDownCommand())
    .onFalse(commandFactory.intakeCommands.createUpCommand());
```

Controller bindings are the obvious use, but triggers also drive things that happen without a button. `RobotContainer` defines triggers for alliance color and enabled state, and uses them to run setup commands the moment the Driver Station reports a value.

```java
private final Trigger allianceInitialized =
    new Trigger(() -> DriverStation.getAlliance().isPresent());
```

:::tip
Every `Trigger` method returns the trigger, so `onTrue` and `onFalse` can be chained on the same button as shown above.
:::

## Command factories

:::info
The examples on this page come from the [2026 season code](https://github.com/AEMBOT/FRC_2026), which has a full set of mechanisms. The template only ships with a drivetrain and vision, so its `CommandFactory` is a stub. The pattern is the same. Follow the season repo to see it filled in.
:::

Nothing in this codebase constructs a command inline at the binding site. Commands come from factory methods, and the factories are arranged in three layers. Each layer only knows about the one below it.

### Subsystem command methods

The bottom layer is the subsystem itself. Every subsystem exposes methods that return a `Command` requiring that subsystem and nothing else. These are the only places where hardware is actually told to do something.

```java
// From MotorSubsystem in the library
public Command smartVelocitySetpointCommand(DoubleSupplier velocity) {
  return runEnd(
          () -> setSmartVelocitySetpointImpl(velocity.getAsDouble()),
          () -> {})
      .withName("SmartVelocityControl");
}
```

The library's [`MotorSubsystem`](../../reference/subsystems/motor-subsystem#commands) provides a full set of these for any motor driven mechanism: duty cycle, voltage, position, and velocity, in both PID and Motion Magic flavors. A subsystem that extends it, such as `FlywheelSubsystem`, gets all of them for free and adds any that are specific to it. Season subsystems like the intake deploy add things like `putIntakeUpCommand()` and `getZeroDownwardCommand()`.

The rule for this layer: a subsystem command method takes suppliers, not values, and never references another subsystem.

### Mechanism factories

The middle layer groups the subsystems that make up one mechanism. `IntakeCommands` owns the deploy, roller, and wheel subsystems. `ShooterCommands` owns the hood, turret, and flywheel. Each is an ordinary class that takes its subsystems in the constructor and stores them in fields.

```java
public final class IntakeCommands {
  private final OverBumperIntakeDeploySubsystem deploy;
  private final IntakeRollerMultiMotorSubsystem roller;
  private final BinaryVoltageMotorFollowerSubsytem wheels;

  public IntakeCommands(OverBumperIntakeDeploySubsystem deploy, ...) {
    this.deploy = deploy;
    ...
  }

  public Command createRunIntakeCommand() {
    return roller.runRollerCommand().alongWith(wheels.runSystemCommand());
  }

  public Command createStopIntakeCommand() {
    return roller.stopRollerCommand().alongWith(wheels.stopSystemCommand());
  }
}
```

Most methods here are one line: either pass a subsystem command straight through, or combine two or three with `alongWith`. Anything that needs to coordinate the parts of one mechanism lives here. "Run the intake" means running the roller and the wheels together, and the factory is where that fact is recorded.

The shooter factory is larger because aiming needs math. It holds the lookup tables that turn a distance into a flywheel speed and hood angle, and its methods take `Supplier<Pose2d>` and `Supplier<Translation2d>` so that a command can keep aiming at a moving target. That math belongs in the factory, not in the subsystems, because it involves three subsystems at once and none of them should know about the other two.

Method names follow the pattern `create<Action>Command`. The `create` prefix is a reminder that each call builds a new command object.

### The top level factory

`CommandFactory` sits above the mechanism factories. It builds them in its constructor, exposes them as public fields, and adds the commands that cut across mechanisms.

```java
public final class CommandFactory {
  private final DriveSubsystem driveSubsystem;
  public final IntakeCommands intakeCommands;
  public final ShooterCommands shooterCommands;

  public CommandFactory(DriveSubsystem driveSubsystem, HoodSubsystem hoodSubsystem, ...) {
    this.driveSubsystem = driveSubsystem;
    this.intakeCommands = new IntakeCommands(intakeDeploySubsystem, intakeRollerSubsystem, intakeWheelsSubsystem);
    this.shooterCommands = new ShooterCommands(hoodSubsystem, turretSubsystem, flywheelSubsystem);
  }
}
```

Shooting a game piece is the clearest example of something that belongs here. It needs the shooter to be at speed and the intake to feed at the same time, so it touches both mechanism factories.

```java
this.aimTrigger =
    new Trigger(() -> shootFuel).whileTrue( // while the shootFuel flag is true, run this
            shooterCommands
                .createShootFuelCommand() // aim and spin up the shooter
                .alongWith(intakeRollerSubsystem.runRollerCommand()) // and feed from the roller
                .alongWith(intakeWheelsSubsystem.runSystemCommand())); // and the intake wheels

public Command createShootFuelCommand() {
  return new RunCommand(() -> shootFuel = true) // set the flag every loop while held
      .finallyDo(() -> shootFuel = false); // clear it when the command ends
}
```

This uses a pattern worth knowing. Rather than binding the full shooting composition to a button directly, the factory keeps a boolean field, `shootFuel`, and a trigger that watches it. The command the driver's button runs does nothing but set the flag true while held and false when released. Any other code, such as an auto routine, can set the same flag and get the same behavior without having to rebuild the composition.

Nothing in the factory ever sets the flag on its own. That happens from a button binding in `RobotContainer`.

```java
driverController.rightTrigger().whileTrue(commandFactory.createShootFuelCommand());
```

Following a trigger pull through the code takes four steps.

1. The driver pulls the right trigger. The scheduler sees the button go true and, because the binding is `whileTrue`, schedules `createShootFuelCommand()`.
2. That command runs its body, `shootFuel = true`, on its first loop and every loop after.
3. The scheduler also polls every registered trigger each loop. `aimTrigger`'s condition is `() -> shootFuel`, so on the same loop it sees the flag go from false to true and schedules the shooting composition.
4. The driver releases the trigger. The flag command ends, `finallyDo` sets `shootFuel = false`, and on the next poll `aimTrigger` sees the flag drop and cancels the composition.

The button never touches the shooter. It runs a tiny command whose only job is to hold the flag up, and the flag is what the shooting trigger watches. Auto does the same thing from a Choreo event marker with `createStartShootingFuelCommand()`, which sets the flag once and leaves it set until a matching stop marker clears it. Both paths land on the same composition without either knowing the other exists.

Drive commands are the exception to the class-per-mechanism layout. `DriveCommands` is a collection of static methods because the drivetrain is one subsystem and needs no held state. `CommandFactory` wraps them so that `RobotContainer` has a single object to call.

### Binding

`RobotContainer` is the only place that touches controllers. It creates the subsystems through `SubsystemFactory`, creates one `CommandFactory`, and then does nothing but wire triggers to factory calls.

```java
driverController.rightTrigger().whileTrue(commandFactory.createShootFuelCommand());
driverController
    .leftTrigger()
    .onTrue(commandFactory.intakeCommands.createZeroDownCommand())
    .onFalse(commandFactory.intakeCommands.createUpCommand());
```

Reading `RobotContainer` should tell you what every button does without telling you how. If a binding line is more than a few tokens long, the logic inside it probably belongs in a factory.

### Why it is layered this way

Each layer can be changed without touching the others.

- Swapping a motor controller changes the subsystem and nothing above it.
- Changing what "run the intake" means changes `IntakeCommands` and nothing above it.
- Remapping a button changes one line in `RobotContainer`.
- Autonomous routines call the same factories as the driver bindings, so a shot in auto and a shot in teleop are guaranteed to be the same code.

:::tip
When adding a new action, start at the bottom. Write the subsystem command first and test it from a temporary button binding. Move it into a mechanism factory once it works. Only reach for `CommandFactory` when the action needs two mechanisms.
:::

## Where things live

| Thing                         | Location                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Subsystem classes             | `lib/subsystems` for reusable ones, `frcXXXX/subsystems` for season specific ones |
| Subsystem construction        | `frcXXXX/subsystems/SubsystemFactory`                                             |
| Command factories             | `frcXXXX/commands`                                                                |
| Default commands and bindings | `frcXXXX/RobotContainer`                                                          |
