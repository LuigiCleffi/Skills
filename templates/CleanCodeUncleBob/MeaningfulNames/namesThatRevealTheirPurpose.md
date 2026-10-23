---
name: meaningful-names
description: Apply the Clean Code principle that variable and function names should reveal their purpose, why they exist, what they do, and how they are used. Use when writing, reviewing, or refactoring code with unclear or generic names.
---

# Meaningful Names: Reveal the Purpose

## Principle

The name of a variable or function should explain why it exists, what it does, and how it is used.

A good name helps a reader understand the code without having to infer its purpose from implementation details or rely on a comment to explain what the name itself failed to communicate.

If a name needs a comment to explain its meaning, consider replacing it with a name that reveals its purpose.

## 1. Name the meaning, not just the type

```java
int d; // elapsed time in days
```

The name `d` communicates almost nothing about the value. The comment reveals information that the name omits.

Prefer names that communicate meaning and units:

```java
int elapsedTimeInDays;
int daysSinceCreation;
int daysSinceModification;
int fileAgeInDays;
```

These names represent different meanings. Choose the one that matches the value's actual purpose.

Ask:
- What does this value represent?
- Why does it exist?
- What does the reader need to know to use it correctly?
- Are its units or business meaning important?

## 2. Names should reveal the purpose of the code

Consider:

```java
public List<int[]> getThem() {
    List<int[]> list1 = ...;

    for (int[] x : theList) {
        if (x[0] == 4) {
            ...
        }
    }

    return list1;
}
```

The code may be valid, but its intent is unclear.

A reader must guess:
1. What kind of things are stored in `theList`?
2. What does index `0` represent?
3. What is the significance of `4`?
4. What does `list1` contain?
5. What does `getThem()` return, and how is the result intended to be used?

Names such as `theList`, `x`, `list1`, and `getThem` hide the domain meaning of the operation.

## 3. Reveal intent with domain-specific names

If the actual domain is a game board where each array represents a cell, index `0` represents its status, and `4` means flagged, the code could become:

```java
public List<int[]> getFlaggedCells() {
    List<int[]> flaggedCells = new ArrayList<>();

    for (int[] cell : gameBoardCells) {
        if (cell[STATUS_INDEX] == FLAGGED_STATUS) {
            flaggedCells.add(cell);
        }
    }

    return flaggedCells;
}
```

This example assumes a specific domain. Never apply these names unless the code's actual behavior confirms that meaning.

The names now communicate:
- `getFlaggedCells`: what the method returns.
- `flaggedCells`: what the collection contains.
- `cell`: what each item represents.
- `gameBoardCells`: what the source collection contains.
- `STATUS_INDEX`: what the array position means.
- `FLAGGED_STATUS`: what the compared value represents.

The names expose the intention behind the operations instead of forcing the reader to memorize unexplained indexes and numbers.

## 4. A good name answers the reader's questions

For every important variable or function, ask:

- **Why does it exist?** What purpose does it serve?
- **What does it represent or do?** What data, concept, or action does it refer to?
- **How is it used?** What does the reader need to know to use it correctly?

Not every name must explain every implementation detail. The goal is to communicate the relevant purpose at the point where the name is encountered.

If essential questions remain unanswered, improve the name or consider whether the surrounding code needs a clearer abstraction.

## 5. Instructions for the AI coding agent

When creating, reviewing, or refactoring code:

1. Identify names that are vague, generic, abbreviated, misleading, or dependent on comments for their meaning.
2. Determine the real purpose from usage, callers, tests, and surrounding domain context.
3. Choose a name that communicates that purpose clearly and accurately.
4. Include relevant details such as domain concepts, roles, conditions, and units.
5. Avoid generic names such as `data`, `list1`, `x`, and `getThem` when more meaningful alternatives are available.
6. Never invent business meaning to make a name sound clearer. If intent cannot be established, ask for clarification or identify the uncertainty.
7. Do not use comments as a substitute for a meaningful name when the name itself can communicate the intended meaning.
8. Avoid unnecessary verbosity. Choose the clearest name that accurately communicates the purpose.
9. Do not rename everything indiscriminately. Make changes where they materially improve understanding, preserving project conventions and public API compatibility unless a change is authorized.
10. Update references consistently and run relevant tests or checks when available.

## Review checklist

- Does the name communicate why the variable or function exists?
- Does it reveal what the value represents or what the function does?
- Does it provide the context needed to use it correctly?
- Does it hide meaning behind unexplained numbers, indexes, abbreviations, or generic terms?
- Is a comment required only because the name is unclear?
- Is the proposed name grounded in actual behavior rather than an assumption?

## Definition of done

A name satisfies this principle when it accurately communicates the relevant purpose of the variable or function, helps readers understand and use it correctly, and does not require a comment merely to explain what the name was supposed to mean.