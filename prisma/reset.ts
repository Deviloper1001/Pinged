import { db } from "../src/lib/db"
import bcrypt from "bcryptjs"

async function main() {
  // Wipe all users + messages + media so we get a clean start.
  // (Any messages/keys generated during testing are tied to browser sessions
  // that no longer exist, so they can't be decrypted anyway.)
  await db.message.deleteMany()
  await db.user.deleteMany()

  const passwordHash = await bcrypt.hash("pass", 10)
  const admin = await db.user.create({
    data: {
      username: "admin",
      passwordHash,
      isAdmin: true,
      mustChangePassword: true,
    },
  })
  console.log(`Reset complete. Fresh admin account: id=${admin.id}`)
  console.log("Login: admin / pass  (you'll be forced to change it on first login)")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
