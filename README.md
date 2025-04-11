# tg-attendance-bot
 
## Overview

The `tg-attendance-bot` is a Telegram bot built to streamline absence management. It allows users to log, track, and manage absences directly through Telegram, making the process simple and efficient. Inspired by the need for better absence management solutions.

## Features

- Effortlessly log absences using Telegram commands.
- View detailed absence history and summaries.
- Set custom absence durations in minutes for more flexibility.
- Automatically close absences when the specified time (in minutes) has passed.
- This bot is using Indonesian language, as it was initially developed for use in Indonesia.

## Installation

1. Clone the repository:
    ```bash
    git clone https://github.com/izan/absence-telegram-bot.git
    cd absence-telegram-bot
    ```

2. Install the required dependencies:
    ```bash
    npm install
    ```

3. Configure environment variables:
    - Create a `.env` file in the root directory.
    - Add the following variables:
      ```
      TELEGRAM_BOT_TOKEN=your_telegram_bot_token
      DATABASE_URL="file:./dev.db"
      ```

4. Set up Prisma:
    - Initialize the Prisma database:
      ```bash
      npx prisma migrate dev --name init
      ```
      This will create the database schema based on the Prisma schema file (`prisma/schema.prisma`).
    - If you need to inspect the database, you can use Prisma Studio:
      ```bash
      npx prisma studio
      ```

5. Start the bot:
    ```bash
    node bot.js
    ```

## Usage

- Invite bot to the group.
- Send `/start` to the bot in Telegram to begin.
- Send `/set <NIM Name>` to set your NIM (Student ID) and Name.
- Send `/absensi <Subject> <Duration (minutes)>` to start an attendance session.

Enjoy using the bot! 😊

- Anyone can initiate an attendance session with the appropriate command.
- Users must set their NIM (Student ID) and Name first using the `/set` command before they can start an attendance session.
- Admins can directly stop an ongoing absence session.

## Contributing

We welcome contributions! To contribute:

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes and push the branch.
4. Submit a pull request for review.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.
