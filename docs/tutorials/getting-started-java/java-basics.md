---
sidebar_position: 1
title: Java Basics
---

# Java Basics

Robot code is written in Java. This page covers the smallest pieces of the language: how values are stored, how code is grouped, and how decisions are made. Everything else in the codebase is built out of these.

## Variables and types

A variable is a named slot that holds a value. In Java, every variable has a type, and the type is written before the name. Once declared, a variable can only ever hold values of that type.

```java
double wheelRadius = 0.0508;   // a number with a decimal point, in meters
int motorID = 54;              // a whole number
boolean isEnabled = true;      // true or false
String robotName = "Timothy";  // text
```

The types that show up constantly in robot code are listed below.

| Type      | Holds                  | Example               |
| --------- | ---------------------- | --------------------- |
| `double`  | Decimal numbers        | `3.14`, `-0.5`, `2.0` |
| `int`     | Whole numbers          | `54`, `0`, `-1`       |
| `boolean` | `true` or `false`      | `true`                |
| `String`  | Text, in double quotes | `"FlywheelMotor"`     |

The first three are primitives. `String` is an object. The difference is explained [below](#primitives-and-objects).

Almost every physical quantity is a `double`. Positions, velocities, voltages, and angles are all doubles. Use `int` only for things that are counted, like CAN IDs and slot numbers.

:::info
`2` and `2.0` are different types. `2` is an `int`. `2.0` is a `double`. Dividing two ints throws away the remainder, so `7 / 2` is `3`, but `7.0 / 2` is `3.5`. When in doubt, write the decimal point.
:::

## Statements

A statement is one instruction. Every statement ends with a semicolon. Statements run top to bottom.

```java
double circumference = 2.0 * Math.PI * wheelRadius;
double rotations = distance / circumference;
```

The `=` sign is assignment, not equality. It means "put the value on the right into the variable on the left." Comparing two values uses `==` instead.

## Methods

A method is a named block of code that can be run from elsewhere. It may take inputs, called parameters, and may hand back a result, called the return value. The return type is written before the name, and `void` means nothing is returned.

```java
public double getUnitsToRotorRotations(double units) {
  return units / this.kUnitToRotorRotationRatio;
}
```

This method takes one `double` named `units` and returns a `double`. Calling it looks like this.

```java
double rotations = config.getUnitsToRotorRotations(1.5);
```

A `void` method does its work and hands nothing back. It is called for its effect, not its result, so the call stands on its own as a statement.

```java
public void setMasterCANDevice(CANDeviceID master) {
  this.masterDevice = master;
}
```

```java
followerDevice.setMasterCANDevice(leadDevice);
```

There is no `return` line in a void method. The body simply ends. Writing `return;` with nothing after it is allowed and exits the method early, which is occasionally used to bail out of a method when a check fails.

Curly braces `{ }` mark the start and end of the method body. Everything inside is indented, which Java does not require but the codebase's formatter enforces.

## Primitives and objects

Java has two kinds of values, and the difference matters most when passing them into methods.

**Primitives** are the built in types with lowercase names: `double`, `int`, `boolean`, and a few others. A primitive variable holds the value itself. Copying it makes an independent copy.

**Objects** are everything else, and their type names start with a capital letter: `String`, `Pose2d`, `MotorConfiguration`, and every class in the codebase. An object variable does not hold the object. It holds a reference, which is a pointer to where the object lives. Copying the variable copies the pointer, and both copies point at the same object.

```java
int a = 5;
int b = a;      // b gets its own 5
b = 6;          // a is still 5

Pose2d p = new Pose2d(1, 2, Rotation2d.kZero);
Pose2d q = p;   // q points at the same object as p
```

The same rule applies to method parameters. A method that takes a primitive receives a copy and cannot change the caller's variable.

```java
void tryToDouble(double x) {
  x = x * 2;    // changes only the local copy
}

double speed = 5.0;
tryToDouble(speed);   // speed is still 5.0
```

A method that takes an object receives a copy of the reference. It cannot swap the caller's variable for a different object, but it can call methods on the object it was given, and those changes are visible to the caller.

```java
void fillInputs(MotorInputs inputs) {
  inputs.positionUnits = 3.0;   // modifies the object the caller passed
}

MotorInputs flywheelInputs = new MotorInputs();
fillInputs(flywheelInputs);
// flywheelInputs.positionUnits is now 3.0
```

This is exactly how the IO layer works. `io.updateInputs(inputs)` returns nothing. It fills in the fields of the inputs object it was handed, and the subsystem reads them afterward. If `MotorInputs` were a primitive, that pattern would be impossible.

:::info
Some objects cannot be modified after creation. `String` and WPILib geometry types like `Pose2d` and `Rotation2d` are like this. Every method on them that looks like it changes something actually returns a new object, and the original is untouched. `pose.plus(transform)` gives you a new pose. It does not move `pose`.
:::

The two kinds also differ in what an empty variable holds. A primitive always has a value, and defaults to `0` or `false`. An object variable can be `null`, which means it points at nothing. Calling a method on `null` crashes the robot code with a `NullPointerException`, which is the most common runtime error you will see.

## Making decisions

An `if` statement runs its body only when the condition inside the parentheses is true.

```java
if (velocity > maxVelocity) {
  velocity = maxVelocity;
}
```

`else` handles the other case, and `else if` chains more conditions.

```java
if (RobotRuntimeConstants.MODE == RuntimeMode.REAL) {
  gains = realGains;
} else {
  gains = simGains;
}
```

When the same value is compared against several fixed options, `switch` is clearer than a chain of `else if`. `SubsystemFactory` uses this to pick hardware, simulation, or replay.

```java
switch (RobotRuntimeConstants.MODE) {
  case SIM:
    return new HoodSimIO(config);
  case REPLAY:
    return new HoodIOReplay();
  case REAL:
  default:
    return new TalonFXHoodHardwareIO(config);
}
```

`default` runs when nothing else matched. Putting `case REAL:` directly above `default:` with no code between means both share the same body.

The comparison operators are the usual ones: `<`, `>`, `<=`, `>=`, `==`, and `!=` for not equal. Conditions combine with `&&` for and, `||` for or, and `!` for not.

## Conditional expressions

A shorter form of `if` exists for choosing between two values. The syntax is `condition ? valueIfTrue : valueIfFalse`. Most people call this the ternary operator, since it is the only operator in Java that takes three operands.

```java
public static final ConfigureSlot0Gains MOTOR_GAINS =
    (RobotRuntimeConstants.MODE == RuntimeMode.REAL)
        ? new ConfigureSlot0Gains(0.0, 0.0, 0.0, 0.0, 0.4, 0.132, 0.0)
        : new ConfigureSlot0Gains(5, 0, 0, 0, 0, 0.1, 0);
```

This reads as "if the mode is real, use the first set of gains, otherwise use the second." It shows up in configuration files where sim and real robot need different constants.

## Loops

A `for` loop repeats a block a fixed number of times, or once for each item in a collection.

```java
for (int i = 0; i < 4; i++) {
  modules[i].stop();
}

for (CameraConfiguration camera : cameraConfigs) {
  cameras.add(new AprilVisionSubsystem(camera));
}
```

The second form is far more common in this codebase. It reads as "for each `camera` in `cameraConfigs`."

Loops are rare in robot code compared to other kinds of programs. The robot's main loop is provided by WPILib and runs the code 50 times a second on its own. Writing a loop that waits for something to happen will freeze the robot.

## Comments

Anything after `//` on a line is ignored by Java. Multi-line comments sit between `/*` and `*/`. Comments that start with `/**` are documentation comments, and tools use them to generate reference pages.

```java
// A short note about the line below
double gearRatio = 18400.0 / 243.0; // exact ratio from the CAD

/*
 * A longer note that needs more than one line.
 * Everything between the markers is ignored.
 */
double startingAngle = 131.67;

/**
 * Convert rotor rotations into the units this configuration uses.
 *
 * @param rotorRotations Rotor rotation value to convert
 * @return The equivalent value in units
 */
public double getRotorRotationsToUnits(double rotorRotations) {
  return rotorRotations * this.kUnitToRotorRotationRatio;
}
```

The third form is what appears above nearly every class and public method in the library. The `@param` and `@return` lines are a convention for documenting inputs and outputs, and editors show them as a tooltip when hovering over a call to the method.

## Naming

The codebase follows a few naming rules, written down in `aem-style-guide.txt` at the repo root.

| Kind                                     | Style                      | Example                     |
| ---------------------------------------- | -------------------------- | --------------------------- |
| Variables and methods                    | lowerCamelCase             | `wheelRadius`               |
| Constants set once when a class is built | `k` prefix, UpperCamelCase | `kUnitToRotorRotationRatio` |
| Constants fixed for the whole project    | ALL_CAPS_WITH_UNDERSCORES  | `MOTOR_CURRENT_LIMIT`       |
| Classes                                  | UpperCamelCase             | `FlywheelSubsystem`         |

## Where to look

`ProductionFlywheelConfig` in the [2026 season code](https://github.com/AEMBOT/FRC_2026) is a good first file to read, alongside the [Flywheel Configuration](../../reference/config/flywheel-configuration) reference it builds. It is almost entirely variable declarations and arithmetic, with one conditional expression, and it uses every type in the table above.
