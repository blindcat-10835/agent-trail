import { NextResponse } from "next/server";
import { exec } from "node:child_process";

export async function POST() {
  return new Promise<NextResponse>((resolve) => {
    exec("systemctl restart openclaw", (err1) => {
      if (!err1) {
        resolve(NextResponse.json({ success: true }));
        return;
      }
      exec("systemctl --user restart openclaw", (err2) => {
        if (!err2) {
          resolve(NextResponse.json({ success: true }));
          return;
        }
        exec("systemctl --user restart openclaw-gateway", (err3) => {
          if (!err3) {
            resolve(NextResponse.json({ success: true }));
            return;
          }
          resolve(
            NextResponse.json(
              { success: false, error: "All restart attempts failed" },
              { status: 500 }
            )
          );
        });
      });
    });
  });
}
