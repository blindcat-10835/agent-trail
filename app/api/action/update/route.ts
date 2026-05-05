import { NextResponse } from "next/server";
import { exec } from "node:child_process";

export async function POST() {
  return new Promise<NextResponse>((resolve) => {
    exec("npm update -g openclaw", { timeout: 120000 }, (err, stdout) => {
      if (err) {
        resolve(
          NextResponse.json(
            { success: false, error: err.message },
            { status: 500 }
          )
        );
        return;
      }
      resolve(
        NextResponse.json({ success: true, output: (stdout || "").trim() })
      );
    });
  });
}
