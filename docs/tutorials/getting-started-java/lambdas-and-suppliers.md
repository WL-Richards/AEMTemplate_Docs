---
sidebar_position: 4
title: Lambdas and Suppliers
---

# Lambdas and Suppliers

A lambda is a small piece of code passed around as a value. Instead of handing a method a number, you hand it a recipe for producing a number. Command-based code uses lambdas constantly, and they are the part of Java that most often confuses people coming from other languages.

## The syntax

A lambda is a parameter list, an arrow, and a body.

```java
() -> 5.0                          // takes nothing, returns 5.0
(vel) -> vel * 0.9                 // takes one value, returns it scaled
(a, b) -> a + b                    // takes two
() -> { motor.stop(); }            // takes nothing, returns nothing, runs a statement
```

When the body is a single expression, its value is returned automatically. When the body is in curly braces, it is a block of statements, and `return` must be written out if a value is needed.

Parameter types are usually left off because Java can work them out from context.

## Why commands use them

Compare these two lines.

```java
flywheel.smartVelocitySetpointCommand(5.0);        // hypothetical, does not exist
flywheel.smartVelocitySetpointCommand(() -> 5.0);  // what the library actually takes
```

The first would pass the number 5 once, when the command is created. The second passes a recipe that the command runs every loop to ask "what should the velocity be right now?" For a fixed value the difference does not matter. For a value that changes, it is everything.

```java
flywheel.smartVelocitySetpointCommand(() -> shootingTable.get(distanceToGoal()));
```

Now the setpoint is recomputed 50 times a second from the robot's current distance. The command was written once and does not know about distance at all.

## Supplier types

Java gives the recipe a type based on what it takes and returns. These are the ones that appear in the codebase.

| Type              | Takes   | Returns   | Get the value with |
| ----------------- | ------- | --------- | ------------------ |
| `DoubleSupplier`  | nothing | `double`  | `.getAsDouble()`   |
| `BooleanSupplier` | nothing | `boolean` | `.getAsBoolean()`  |
| `Supplier<T>`     | nothing | a `T`     | `.get()`           |
| `Function<A, B>`  | an `A`  | a `B`     | `.apply(a)`        |
| `Runnable`        | nothing | nothing   | `.run()`           |

A method that accepts a `DoubleSupplier` can be given any lambda that takes nothing and returns a double. The library's `MotorSubsystem` commands are all written this way.

```java
public Command smartVelocitySetpointCommand(DoubleSupplier velocity) {
  return runEnd(
      () -> setSmartVelocitySetpointImpl(velocity.getAsDouble()), // runs every loop
      () -> {});                                                  // runs once at the end
}
```

`Supplier<Pose2d>` and `Supplier<Translation2d>` are used to pass positions into command factories so the command always sees the latest estimate.

## Method references

When a lambda does nothing but call one existing method, it can be written as the method name with `::`.

```java
() -> DriverStation.isEnabled()         // lambda
DriverStation::isEnabled                // method reference, same thing

() -> state.getSpindexerCommandedState()
state::getSpindexerCommandedState
```

Both forms are used. The method reference is shorter, and the lambda is easier to read when starting out. There is no difference in behavior.

## Capturing variables

A lambda can use variables from the code around it. Those variables must be `final`, or at least never reassigned after being set. The compiler enforces this.

```java
double target = 5.0;
Command spinUp = flywheel.smartVelocitySetpointCommand(() -> target); // fine

double target = 5.0;
target = 6.0;                                                          // reassigned
Command spinUp = flywheel.smartVelocitySetpointCommand(() -> target); // will not compile
```

Fields on an object are not restricted this way. A lambda inside a subsystem can read the subsystem's fields freely, and it sees the current value each time it runs. That is how a command can react to state that changes after the command was built.

## Where to look

`ShooterCommands` in the [2026 season code](https://github.com/AEMBOT/FRC_2026) takes suppliers in its constructor and passes lambdas into nearly every command it builds. `MotorSubsystem` in `lib/subsystems/base` shows the other side, methods that accept a `DoubleSupplier` and call it inside `runEnd`.
