# React useState Hook

The `useState` hook is a fundamental hook in React that allows functional components to manage state.

## Basic Usage

```javascript
import React, { useState } from 'react';

function Counter() {
  // Declares a new state variable called "count"
  // useState returns a pair: the current state value and a function that lets you update it.
  const [count, setCount] = useState(0); // 0 is the initial state

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click me
      </button>
    </div>
  );
}
```

## Initial State

The argument passed to `useState` is the initial state. This initial state is only used during the first render.

## Updating State

To update a state variable, call the updater function (e.g., `setCount`) with the new state. React will then re-render the component and its children.

## Functional Updates

If the new state is computed using the previous state, you can pass a function to the state updater. This function will receive the previous value and return an updated value.

```javascript
setCount(prevCount => prevCount + 1);
```
This is preferred when the new state depends on the old state, especially in asynchronous operations or when multiple updates are batched.

## Key Considerations
- Call Hooks only at the top level of your React functions.
- Call Hooks only from React functional components or custom Hooks.
- `useState` declares a "state variable". You can use it more than once in a single component.
