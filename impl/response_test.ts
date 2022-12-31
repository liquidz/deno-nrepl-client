import { asserts } from "../test_deps.ts";
import { NreplResponseImpl } from "./response.ts";

Deno.test("Response id", () => {
  const resp = new NreplResponseImpl([{ id: "123" }]);
  asserts.assertEquals(resp.id(), "123");

  const nullResp = new NreplResponseImpl([{ op: "clone" }]);
  asserts.assertEquals(nullResp.id(), null);
});

Deno.test("Response get", () => {
  const resp = new NreplResponseImpl([{ id: "123" }, { status: ["done"] }]);
  asserts.assertEquals(resp.get("id"), ["123"]);
});

Deno.test("Response getOne", () => {
  const resp = new NreplResponseImpl([{ id: "123" }]);
  asserts.assertEquals(resp.getOne("id"), "123");
  asserts.assertEquals(resp.getOne("op"), null);
});

Deno.test("Response isDone", () => {
  const resp = new NreplResponseImpl([{ id: "123" }, { status: ["done"] }]);
  asserts.assertEquals(resp.isDone(), true);

  const errorResp = new NreplResponseImpl([{ id: "123" }, {
    status: ["error"],
  }]);
  asserts.assertEquals(errorResp.isDone(), false);
});
