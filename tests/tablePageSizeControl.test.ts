import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { TablePageSizeControl } from "../src/components/TablePageSizeControl";

const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
after(() => {
  if (originalActEnvironment) Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
  else Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

type InputProps = {
  value: string;
  type: string;
  min: number;
  max: number;
  step: number;
  "aria-label": string;
  onChange: (event: { target: { value: string } }) => void;
  onBlur: () => void;
  onKeyDown: (event: { key: string; currentTarget: { blur: () => void } }) => void;
};

function withRenderer(
  pageSize: number,
  onPageSizeChange: (pageSize: number) => void,
) {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(createElement(TablePageSizeControl, { pageSize, onPageSizeChange }));
  });
  const input = () => renderer.root.findByType("input").props as InputProps;
  return { renderer: renderer!, input };
}

test("renders the page-size label and input attributes", () => {
  let renderer: ReactTestRenderer | undefined;
  try {
    act(() => {
      renderer = withRenderer(25, () => {}).renderer;
    });
    const input = renderer.root.findByType("input").props as InputProps;
    assert.equal(renderer.root.findByType("span").children[0], "每页 ");
    assert.equal(input.value, "25");
    assert.equal(input.type, "number");
    assert.equal(input.min, 5);
    assert.equal(input.max, 100);
    assert.equal(input.step, 1);
    assert.equal(input["aria-label"], "每页显示行数");
  } finally {
    if (renderer) act(() => renderer?.unmount());
  }
});

test("keeps typing local until blur then commits a valid value", () => {
  const calls: number[] = [];
  const { renderer, input } = withRenderer(25, (value) => calls.push(value));
  try {
    act(() => input().onChange({ target: { value: "30" } }));
    assert.deepEqual(calls, []);
    assert.equal(input().value, "30");
    act(() => input().onBlur());
    assert.deepEqual(calls, [30]);
    assert.equal(input().value, "30");
  } finally {
    act(() => renderer.unmount());
  }
});

test("clamps page-size input when committing", () => {
  const calls: number[] = [];
  const { renderer, input } = withRenderer(25, (value) => calls.push(value));
  try {
    act(() => input().onChange({ target: { value: "2" } }));
    act(() => input().onBlur());
    assert.equal(input().value, "5");
    act(() => input().onChange({ target: { value: "120" } }));
    act(() => input().onBlur());
    assert.equal(input().value, "100");
    assert.deepEqual(calls, [5, 100]);
  } finally {
    act(() => renderer.unmount());
  }
});

test("resets blank, nonnumeric, and decimal input without committing", () => {
  const calls: number[] = [];
  const { renderer, input } = withRenderer(25, (value) => calls.push(value));
  try {
    for (const value of ["", "hello", "25.5"]) {
      act(() => input().onChange({ target: { value } }));
      act(() => input().onBlur());
      assert.equal(input().value, "25");
    }
    assert.deepEqual(calls, []);
  } finally {
    act(() => renderer.unmount());
  }
});

test("commits Enter through blur exactly once", () => {
  const calls: number[] = [];
  const { renderer, input } = withRenderer(25, (value) => calls.push(value));
  let blurCalls = 0;
  try {
    act(() => input().onChange({ target: { value: "30" } }));
    act(() => input().onKeyDown({ key: "Enter", currentTarget: { blur: () => {
      blurCalls++;
      input().onBlur();
    } } }));
    assert.equal(blurCalls, 1);
    assert.deepEqual(calls, [30]);
  } finally {
    act(() => renderer.unmount());
  }
});

test("Escape restores the current page size and blurs without committing", () => {
  const calls: number[] = [];
  const { renderer, input } = withRenderer(25, (value) => calls.push(value));
  let blurCalls = 0;
  try {
    act(() => input().onChange({ target: { value: "30" } }));
    act(() => input().onKeyDown({ key: "Escape", currentTarget: { blur: () => {
      blurCalls++;
      input().onBlur();
    } } }));
    assert.equal(blurCalls, 1);
    assert.equal(input().value, "25");
    assert.deepEqual(calls, []);
  } finally {
    act(() => renderer.unmount());
  }
});

test("synchronizes its draft when the page-size prop changes", () => {
  const onPageSizeChange = () => {};
  const { renderer, input } = withRenderer(25, onPageSizeChange);
  try {
    act(() => {
      renderer.update(createElement(TablePageSizeControl, { pageSize: 50, onPageSizeChange }));
    });
    assert.equal(input().value, "50");
  } finally {
    act(() => renderer.unmount());
  }
});
