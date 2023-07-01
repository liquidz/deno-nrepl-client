import { bencode } from "./deps.ts";
import * as sut from "./mock.ts";
import { asserts } from "./test_deps.ts";

Deno.test("write", async () => {
  const relay = (msg: bencode.BencodeObject): bencode.BencodeObject => {
    if (msg["op"] === "eval") {
      return { value: "dummy", status: ["done"] };
    } else {
      return { status: ["done"] };
    }
  };
  const client = new sut.NreplClientMock(relay);

  const evalResp = await client.write({ op: "eval", code: "(do ::something)" });
  asserts.assertEquals(evalResp.isDone(), true);
  asserts.assertEquals(evalResp.id(), null);
  asserts.assertEquals(evalResp.getOne("session"), null);
  asserts.assertEquals(evalResp.get("value"), ["dummy"]);

  const dummyId = crypto.randomUUID();
  const dummySession = crypto.randomUUID();
  const idAndSessionResp = await client.write({
    op: "unknown",
    id: dummyId,
    session: dummySession,
  });
  asserts.assertEquals(idAndSessionResp.isDone(), true);
  asserts.assertEquals(idAndSessionResp.id(), dummyId);
  asserts.assertEquals(idAndSessionResp.getOne("session"), dummySession);
  asserts.assertEquals(idAndSessionResp.get("value"), []);
});

Deno.test("describe", async () => {
  const client = new sut.NreplClientMock(
    (_: bencode.BencodeObject): bencode.BencodeObject => {
      return {};
    },
  );
  asserts.assertEquals((await client.write({ op: "describe" })).getOne("ops"), {
    clone: 1,
    close: 1,
    eval: 1,
  });

  const describeClient = new sut.NreplClientMock(
    (msg: bencode.BencodeObject): bencode.BencodeObject => {
      return msg["op"] === "describe" ? { ops: { clone: 1 } } : {};
    },
  );
  asserts.assertEquals(
    (await describeClient.write({ op: "describe" })).getOne("ops"),
    { clone: 1 },
  );
});

Deno.test("clone", async () => {
  const client = new sut.NreplClientMock(
    (_: bencode.BencodeObject): bencode.BencodeObject => {
      return {};
    },
  );
  const resp = await client.write({ op: "clone" });
  asserts.assertNotEquals(resp.getOne("new-session"), undefined);

  const cloneClient = new sut.NreplClientMock(
    (msg: bencode.BencodeObject): bencode.BencodeObject => {
      return msg["op"] === "clone" ? { "new-session": "dummySession" } : {};
    },
  );
  asserts.assertEquals(
    (await cloneClient.write({ op: "clone" })).getOne("new-session"),
    "dummySession",
  );
});
