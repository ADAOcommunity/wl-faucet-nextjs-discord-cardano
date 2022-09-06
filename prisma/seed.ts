import { Address } from '@emurgo/cardano-serialization-lib-browser'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const fs = require('fs')
const _ = require('lodash')
async function main() {

  const seed = JSON.parse(fs.readFileSync("prisma/seed.json"))
  // let test = await prisma.whitelistedUser.create({
  //   data: {
  //     id: 'asdasdasd',
  //     quantity: 123,
  //     claimed: true
  //   }
  // })
  // console.log(seed.s)
  // console.log(test)
  _.each(seed, async (values, address) => {
    if (values.eligible) {
      // console.log(address)
        let record = await prisma.whitelistedUser.create({
            data: {
                id: address,
                quantity: values.count,
                claimed: false
            }
        })
    } else {
      console.log(address + " was rejected for not being eligible: " + values.count)
    }
})
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

