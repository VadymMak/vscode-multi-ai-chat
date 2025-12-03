// src/models/index.ts

// Import necessary types and error handling utilities
import { User, Message, ChatSession } from "../types"; // Assuming these types are defined in src/types/index.ts
import { ValidationError } from "../errors"; // Assuming ValidationError is defined in src/errors/index.ts

// Define a basic User model
export class UserModel {
  private users: User[] = [];

  addUser(user: User): void {
    // Validate user data
    if (!user.id || !user.username) {
      throw new ValidationError("User must have an id and a name.");
    }
    this.users.push(user);
  }

  getUserById(userId: string): User | undefined {
    return this.users.find((user) => user.id === userId);
  }

  getAllUsers(): User[] {
    return this.users;
  }
}

// Define a basic Message model
export class MessageModel {
  private messages: Message[] = [];

  addMessage(message: Message): void {
    // Validate message data
    if (!message.id || !message.content || !message.senderId) {
      throw new ValidationError(
        "Message must have an id, content, and senderId."
      );
    }
    this.messages.push(message);
  }

  getMessagesByUserId(userId: string): Message[] {
    return this.messages.filter((message) => message.senderId === userId);
  }

  getAllMessages(): Message[] {
    return this.messages;
  }
}

// Define a basic ChatSession model
export class ChatSessionModel {
  private sessions: ChatSession[] = [];

  addSession(session: ChatSession): void {
    // Validate session data
    if (!session.id || !session.participants) {
      throw new ValidationError("Session must have an id and participants.");
    }
    this.sessions.push(session);
  }

  getSessionById(sessionId: string): ChatSession | undefined {
    return this.sessions.find((session) => session.id === sessionId);
  }

  getAllSessions(): ChatSession[] {
    return this.sessions;
  }
}
