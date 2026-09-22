---
sidebar_position: 2
title: Classes and Objects
---

# Classes and Objects

Every file of Java is a class. A class is a blueprint that bundles data and the methods that operate on it. An object is one thing built from that blueprint. `FlywheelSubsystem` is a class. The one flywheel on the robot is an object.

## Defining a class

A class declares its fields at the top, then a constructor, then methods.

```java
public class CANDeviceID {
  // Fields hold the object's data
  private final int canID;
  private final String deviceName;

  // Constructor
  public CANDeviceID(int canID, String deviceName) {
    this.canID = canID;
    this.deviceName = deviceName;
  }

  // Method
  public int getDeviceID() {
    return canID;
  }
}
```

**Fields** are variables that belong to the object. Each object gets its own copy.

**The constructor** runs once when the object is created. It has the same name as the class and no return type. Its job is to fill in the fields.

**`this`** refers to the object the code is running on. Inside the constructor, `this.canID` is the field and `canID` on its own is the parameter, so `this.canID = canID` copies one into the other.

## Creating objects

The `new` keyword builds an object from a class and runs the constructor.

```java
CANDeviceID flywheelMotor = new CANDeviceID(54, "FlywheelMotor");
int id = flywheelMotor.getDeviceID(); // 54
```

The variable on the left is typed with the class name. The dot calls a method on that specific object.

Most of the objects in this codebase are created once, in `SubsystemFactory` or in a configuration file, and then handed around. Very little code calls `new` in the middle of a match.

## Access modifiers

`public` and `private` control what other classes can see.

| Modifier    | Visible from                                         | Typical use                                                                     |
| ----------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| `public`    | Anywhere                                             | Command factory methods, getters, and the fields on configuration classes.      |
| `protected` | The same class, its subclasses, and the same package | Fields in `MotorSubsystem` like `io` and `inputs` that subclasses need to read. |
| `private`   | Only the same class                                  | Almost every field, and helper methods that only the class itself calls.        |
| none        | Only the same package                                | Rare. Usually a sign that `private` was forgotten.                              |

Fields are usually `private` with a `public` method to read them. Configuration classes are the exception and use `public` fields on purpose, because they are plain bags of values with no logic to protect.

## `static`

A field or method marked `static` belongs to the class itself, not to any object. There is exactly one copy, and it is accessed through the class name rather than through an object.

```java
public class RobotRuntimeConstants {
  public static final RobotConfiguration ROBOT_CONFIG = ...;
}

// Used from anywhere as
RobotRuntimeConstants.ROBOT_CONFIG.getFlywheelConfiguration();
```

Static is used for two things here: constants that never change, and factory methods like `SubsystemFactory.createDriveSubsystem()` that exist to build objects. A class made only of static members is never instantiated with `new`.

## `final`

`final` on a variable means it can be assigned once and never changed. On a field, that assignment usually happens in the constructor.

```java
private final M io;   // set in the constructor, never reassigned
```

The rule in this codebase is that every field is `final` unless there is a specific reason it cannot be. A `final` field always holds the object it was given at construction, so anyone reading the class knows it will never be swapped out from under them. When a field is left non-final, that is a signal to the reader that something reassigns it later, and there should be a good reason for it.

Reasons a field is allowed to be non-final:

- It is a setpoint or piece of state that the subsystem updates every loop, such as `currentPositionSetpoint` in `MotorSubsystem`.
- It is a flag that a command sets, such as `shootFuel` in the 2026 season's `CommandFactory`.
- It is a builder field on a configuration object, which is filled in by a `with...()` call after construction.

If none of those apply, make it `final`. The compiler will then catch any accidental reassignment.

This is stricter than what most Java code outside FRC does. Robot code has a shape that makes it work: nearly every object is created once at startup, lives for the entire match, and is never replaced. There is little reason for a field to change, so a field that can change stands out. Code written for other environments, where objects are created and torn down constantly, tends to be more relaxed about it.

:::info
`final` on an object reference means the variable will always point at the same object. It does not freeze the object. A `final` list can still have items added to it.
:::

## Method chaining and builders

Configuration objects use a pattern where every setter returns the object it was called on. This allows calls to be chained one after another instead of written on separate lines.

```java
public MotorConfiguration<T> withName(String name) {
  this.kConfigurationName = name;
  return this;             // hand back the same object
}
```

```java
MotorConfiguration<TalonFXConfiguration> config =
    new MotorConfiguration<TalonFXConfiguration>()
        .withName("FlywheelMotor")
        .withMomentOfInertia(0.01)
        .withMinPositionUnits(0);
```

Each `.with...()` line modifies the object and returns it, so the next line has something to call. The whole chain is one expression, and only the final result is stored. Every configuration class in the library works this way.

## Packages and imports

Classes are organized into packages, which are folders. The first line of every file names its package, and it matches the folder path under `src/main/java`.

```java
package com.aembot.lib.config.motors;
```

To use a class from a different package, import it by its full name near the top of the file.

```java
import com.aembot.lib.core.can.CANDeviceID;
import edu.wpi.first.math.util.Units;
```

Classes in the same package do not need to be imported. `edu.wpi.first` is WPILib, `com.ctre.phoenix6` is CTRE, and `org.littletonrobotics.junction` is AdvantageKit. Anything under `com.aembot` is this repo.

:::tip
Imports are almost never typed by hand. Start typing the class name where you want to use it, pick it from the autocomplete list with Tab or Enter, and the editor adds the import line for you. If a class name is underlined in red, hover over it and the editor will offer to import it.
:::

## Where to look

[`CANDeviceID`](../../reference/core/can-device-id) in `lib/core/can` is a small, complete class with private fields, several constructors, and getters. [`MotorConfiguration`](../../reference/config/motor-configuration) in `lib/config/motors` shows the builder pattern with nothing else going on.
