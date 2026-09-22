---
sidebar_position: 2
title: Network Utilities
---

# Network Utilities

`NetworkUtils.MAC` reads the roboRIO's hardware address. It is what `RobotIDYearly` uses to work out which robot the code is running on.

```java
import com.aembot.lib.core.network.NetworkUtils;
```

| Method                         | Returns                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------- |
| `MAC.getMACAddress()`          | The first network interface's hardware address as `AA:BB:CC:DD:EE:FF`, or `null`. |
| `MAC.formatMACAddress(byte[])` | The same formatting for a raw byte array. `null` in, `null` out.                  |

`getMACAddress` walks the JVM's interface list and returns the first one that has a hardware address. On a roboRIO that is the Ethernet port. On a desktop it is whatever the OS lists first, which is why simulation always falls back to the default robot.

If the lookup throws, the exception is logged through `DataLogManager` and `null` is returned. Callers must handle `null`.

```java
String mac = NetworkUtils.MAC.getMACAddress(); // "00:80:2F:12:34:56" or null
```

The formatter uses uppercase hex. MAC addresses in `RobotIDYearly`'s lookup map have to match case for the lookup to succeed.
