import asyncio, sys, time
from aiosmtpd.controller import Controller
from aiosmtpd.smtp import AuthResult

class Handler:
    async def handle_DATA(self, server, session, envelope):
        with open("/home/claude/work/e2e/mail.log", "a") as f:
            f.write(f"\n=== MAIL to {envelope.rcpt_tos} at {time.time()}\n")
            f.write(envelope.content.decode("utf8", "replace"))
        return "250 OK"

def auth(server, session, envelope, mechanism, auth_data):
    return AuthResult(success=True)

c = Controller(Handler(), hostname="127.0.0.1", port=2525, authenticator=auth, auth_require_tls=False)
c.start()
print("smtp sink on 2525", flush=True)
asyncio.get_event_loop().run_forever()
