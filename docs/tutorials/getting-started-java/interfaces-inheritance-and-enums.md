---
sidebar_position: 3
title: Interfaces, Inheritance, and Enums
---

# Interfaces, Inheritance, and Enums

Classes can be related to one another. One class can build on another, or promise to provide a set of methods. This is how the library manages to have one `FlywheelSubsystem` that works on a real robot, in simulation, and in replay without any of that code changing.

## Inheritance

A class can extend another class. The new class starts with everything the original has and can add to it or change it. The new class is called the subclass or child class, and the one it extends is the superclass or parent class. Both pairs of terms are used interchangeably, and `super` in the code below comes from the second.

```java
public class FlywheelSubsystem extends MotorSubsystem<...> {
  @Override
  public void periodic() {
    super.periodic();   // run the parent's version first
    // then do flywheel specific work
  }
}
```

`MotorSubsystem` in the library knows how to read a motor, log its inputs, and run position and velocity commands. `FlywheelSubsystem` extends it and only adds what is specific to a flywheel. The hood, turret, and intake deploy do the same thing.

**`@Override`** marks a method that replaces one from the parent. It is optional, but the codebase always uses it, and the compiler will refuse to build if the marked method does not actually exist in the parent. That catches typos.

**`super`** refers to the parent class. `super.periodic()` runs the parent's `periodic()` from inside the child's. Leaving it out would skip the parent's logging.

## Abstract classes

An abstract class is one that cannot be created with `new`. It exists only to be extended. It can have methods with bodies, and it can have abstract methods, which have a signature but no body and must be filled in by whichever class extends it.

```java
public abstract class RobotConfiguration {
  public abstract String getRobotName();                // no body, subclasses must provide one
  public abstract TalonFXFlywheelConfiguration getFlywheelConfiguration();

  public static RobotConfiguration getRobotConstants(RobotIDYearly id) { // has a body
    ...
  }
}
```

`ProductionConfig extends RobotConfiguration` and is forced to provide every abstract getter. If one is missing, the file will not compile. This is what makes `RobotConfiguration` a checklist for describing a robot rather than a suggestion.

## Interfaces

An interface is a list of method signatures with no bodies and no fields. A class that implements an interface promises to provide all of them.

```java
public interface FlywheelIO {
  public void updateInputs(FlywheelInputs inputs);
  public MotorIO getMotor();
}

public class FlywheelHardwareIO implements FlywheelIO { ... }
public class FlywheelSimIO implements FlywheelIO { ... }
public class FlywheelReplayIO implements FlywheelIO { ... }
```

The subsystem holds a `FlywheelIO`, not a `FlywheelHardwareIO`. It calls `io.updateInputs(inputs)` and does not know or care which of the three it was given.

```java
FlywheelIO io = new FlywheelSimIO(config);   // a sim IO stored as the interface type
```

The difference from an abstract class: a class can extend only one parent, but it can implement any number of interfaces. Interfaces describe what something can do. Abstract classes share how it is done.

:::tip
When reading unfamiliar code, find the interface first. It is the shortest description of what a layer does, with none of the details of how.
:::

## Generics

Some classes take a type as a parameter, written in angle brackets. `List<String>` is a list that holds strings. `MotorConfiguration<TalonFXConfiguration>` is a motor configuration that wraps a TalonFX config.

```java
public class MotorConfiguration<T> {
  public T kMotorConfig;         // T stands in for whatever type is chosen

  public MotorConfiguration<T> withMotorConfig(T config) {
    this.kMotorConfig = config;
    return this;
  }
}
```

`T` is filled in when the object is created. Writing `new MotorConfiguration<TalonFXConfiguration>()` makes every `T` in that object mean `TalonFXConfiguration`, so `withMotorConfig` will only accept one of those.

`MotorSubsystem<I, M, C>` takes three at once: the inputs type, the IO type, and the config type. It looks intimidating in the declaration and is invisible everywhere else. Reading the angle brackets as "a motor subsystem built out of these three things" is enough.

## Enums

An enum is a type with a fixed set of named values. When something can only be one of a few things, an enum is safer than a number or a string, because the compiler rejects anything not on the list.

```java
public enum RuntimeMode {
  REAL,
  SIM,
  REPLAY
}
```

Enum values are compared with `==` and used in `switch`.

```java
if (RobotRuntimeConstants.MODE == RuntimeMode.SIM) { ... }
```

Enums can also carry data and methods. `RobotIDYearly` is an enum whose values each have a name and a MAC address, and it implements the `RobotID` interface like any other class would.

```java
public enum RobotIDYearly implements RobotID {
  PRODUCTION("Production Bot"),
  PRACTICE("Practice Bot");

  private final String name;

  private RobotIDYearly(String name) {
    this.name = name;
  }
}
```

The values are listed first, each calling the constructor. The rest of the body is ordinary class code.

## Where to look

[`RobotID`](../../reference/config/robot-id) and `RobotIDYearly` in the config packages are a short interface and a short enum that implements it. [`MotorSubsystem`](../../reference/subsystems/motor-subsystem) in `lib/subsystems/base` is the parent of most mechanisms and shows generics and abstract methods together.
