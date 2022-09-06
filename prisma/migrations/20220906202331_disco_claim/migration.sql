-- CreateTable
CREATE TABLE "UtxoRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "used" DATETIME NOT NULL,
    "usedById" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "claimant" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "WhitelistedUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quantity" INTEGER NOT NULL,
    "claimed" BOOLEAN NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WhitelistedUser_id_key" ON "WhitelistedUser"("id");
