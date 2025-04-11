-- CreateTable
CREATE TABLE "User" (
    "telegramId" TEXT NOT NULL PRIMARY KEY,
    "nim" TEXT NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "initiatorId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "messageId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AttendanceList" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "attendanceId" INTEGER NOT NULL,
    "telegramId" TEXT NOT NULL,
    "time" DATETIME NOT NULL,
    CONSTRAINT "AttendanceList_attendanceId_fkey" FOREIGN KEY ("attendanceId") REFERENCES "Attendance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
