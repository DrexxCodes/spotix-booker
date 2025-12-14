export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) {
    return "Good morning"
  } else if (hour >= 12 && hour < 18) {
    return "Good afternoon"
  } else {
    return "Good evening"
  }
}

export function getGreetingEmoji(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) {
    return "🌅"
  } else if (hour >= 12 && hour < 18) {
    return "☀️"
  } else {
    return "🌙"
  }
}

export function getGreetingAddon(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) {
    return "Early for the hussle yeah?"
  } else if (hour >= 12 && hour < 18) {
    return "Mid day grind? Keep it up!"
  } else {
    return "Burning the midnight oil?"
  }
}
