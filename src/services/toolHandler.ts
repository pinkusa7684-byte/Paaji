import { ToolExecutionResult } from '../types/assistant';
import { ALLOWED_APPS } from '../config/constants';
import { contactsService } from './contactsService';
import { remindersService } from './remindersService';
import { notesService } from './notesService';
import { memoryService } from './memoryService';

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
  console.log(`[ToolHandler] Executing ${name} with args:`, args);

  switch (name) {
    case 'openApp': {
      const rawApp = String(args.appName || args.app || '').toLowerCase().replace(/\s+/g, '');
      const matchedKey = Object.keys(ALLOWED_APPS).find(k => k.includes(rawApp) || rawApp.includes(k));

      if (!matchedKey || !ALLOWED_APPS[matchedKey]) {
        return {
          success: false,
          toolName: 'openApp',
          message: `App '${args.appName}' is not in the allowed applications list. Allowed apps: WhatsApp, YouTube, Instagram, Google Maps, Chrome, Gmail, Spotify, Calculator.`,
        };
      }

      const appConfig = ALLOWED_APPS[matchedKey];
      try {
        // Open the app via native intent if available or safe web fallback
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        const targetUrl = (isMobile && appConfig.nativeIntent) ? appConfig.nativeIntent : appConfig.url;

        window.open(targetUrl, '_blank', 'noopener,noreferrer');
        return {
          success: true,
          toolName: 'openApp',
          message: `Successfully opened ${appConfig.name}.`,
          data: { app: appConfig.name, targetUrl },
          actionDetails: {
            type: 'openApp',
            label: `Opened ${appConfig.name}`,
            target: appConfig.name,
          },
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          toolName: 'openApp',
          message: `Could not open ${appConfig.name}: ${errorMsg}`,
        };
      }
    }

    case 'openWhatsApp': {
      const phone = args.phone ? String(args.phone).replace(/[^\d+]/g, '') : '';
      const text = args.message ? encodeURIComponent(String(args.message)) : '';

      let waUrl = 'https://web.whatsapp.com';
      if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        waUrl = phone ? `whatsapp://send?phone=${phone}&text=${text}` : 'whatsapp://';
      } else {
        waUrl = phone ? `https://web.whatsapp.com/send?phone=${phone}&text=${text}` : 'https://web.whatsapp.com';
      }

      try {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
        return {
          success: true,
          toolName: 'openWhatsApp',
          message: 'Opened WhatsApp successfully.',
          data: { url: waUrl },
          actionDetails: {
            type: 'openApp',
            label: 'Opened WhatsApp',
            target: 'WhatsApp',
          },
        };
      } catch (err) {
        return {
          success: false,
          toolName: 'openWhatsApp',
          message: `Failed to launch WhatsApp: ${String(err)}`,
        };
      }
    }

    case 'openUrl': {
      const url = String(args.url || '').trim();
      if (!url.startsWith('https://') && !url.startsWith('http://')) {
        return {
          success: false,
          toolName: 'openUrl',
          message: 'Disallowed URL format. URLs must explicitly begin with https:// or http://.',
        };
      }

      try {
        window.open(url, '_blank', 'noopener,noreferrer');
        return {
          success: true,
          toolName: 'openUrl',
          message: `Opened link: ${url}`,
          actionDetails: {
            type: 'url',
            label: `Opened ${url}`,
            target: url,
          },
        };
      } catch (err) {
        return {
          success: false,
          toolName: 'openUrl',
          message: `Failed to open URL: ${String(err)}`,
        };
      }
    }

    case 'makeCall': {
      const phone = String(args.phoneNumber || '').trim();
      if (!phone || phone.length < 3) {
        return {
          success: false,
          toolName: 'makeCall',
          message: 'Invalid phone number provided.',
        };
      }

      const result = contactsService.initiateCall(phone);
      return {
        success: result.success,
        toolName: 'makeCall',
        message: `Dialing ${args.contactName ? args.contactName + ' at ' : ''}${phone}`,
        actionDetails: {
          type: 'call',
          label: `Calling ${args.contactName || phone}`,
          target: phone,
        },
      };
    }

    case 'callContact': {
      const contactName = String(args.name || '').trim();
      if (!contactName) {
        return {
          success: false,
          toolName: 'callContact',
          message: 'Please provide a contact name to call.',
        };
      }

      const { matches, exactMatch } = contactsService.findContact(contactName);

      if (exactMatch) {
        contactsService.initiateCall(exactMatch.phone);
        return {
          success: true,
          toolName: 'callContact',
          message: `Calling ${exactMatch.name} (${exactMatch.phone}).`,
          data: exactMatch,
          actionDetails: {
            type: 'call',
            label: `Calling ${exactMatch.name}`,
            target: exactMatch.phone,
          },
        };
      }

      if (matches.length > 1) {
        const names = matches.map(m => `${m.name} (${m.phone})`).join(', ');
        return {
          success: false,
          toolName: 'callContact',
          message: `Found multiple contacts matching '${contactName}': ${names}. Please specify which one you want to call.`,
          data: { matches },
        };
      }

      return {
        success: false,
        toolName: 'callContact',
        message: `No contact found with name '${contactName}' in contacts.`,
      };
    }

    case 'getTime': {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

      return {
        success: true,
        toolName: 'getTime',
        message: `Current time is ${timeStr} on ${dateStr} (${tz}).`,
        data: { time: timeStr, date: dateStr, timeZone: tz },
        actionDetails: {
          type: 'time',
          label: `${timeStr} (${dateStr})`,
        },
      };
    }

    case 'getWeather': {
      const location = String(args.location || 'New Delhi').trim();
      try {
        // Geocode location using Open-Meteo free geocoding
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
          return {
            success: false,
            toolName: 'getWeather',
            message: `Could not find location '${location}'.`,
          };
        }

        const { latitude, longitude, name, country } = geoData.results[0];
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`
        );
        const weatherData = await weatherRes.json();
        const current = weatherData.current;

        // Interpret WMO weather codes
        const codeMap: Record<number, string> = {
          0: 'Clear sky',
          1: 'Mainly clear',
          2: 'Partly cloudy',
          3: 'Overcast',
          45: 'Fog',
          48: 'Depositing rime fog',
          51: 'Light drizzle',
          61: 'Slight rain',
          63: 'Moderate rain',
          65: 'Heavy rain',
          71: 'Slight snow',
          80: 'Rain showers',
          95: 'Thunderstorm',
        };
        const condition = codeMap[current.weather_code] || 'Fair';
        const temp = `${Math.round(current.temperature_2m)}°C`;
        const feelsLike = `${Math.round(current.apparent_temperature)}°C`;
        const summary = `${name}, ${country}: ${temp}, ${condition}. Feels like ${feelsLike}, humidity ${current.relative_humidity_2m}%.`;

        return {
          success: true,
          toolName: 'getWeather',
          message: summary,
          data: { city: name, country, temp, condition, feelsLike, humidity: current.relative_humidity_2m },
          actionDetails: {
            type: 'weather',
            label: `${name}: ${temp}, ${condition}`,
          },
        };
      } catch (err) {
        return {
          success: false,
          toolName: 'getWeather',
          message: `Unable to fetch live weather: ${String(err)}`,
        };
      }
    }

    case 'setReminder': {
      const task = String(args.task || 'Reminder').trim();
      const timeString = args.timeString ? String(args.timeString) : undefined;
      const reminder = remindersService.createReminder(task, timeString);

      return {
        success: true,
        toolName: 'setReminder',
        message: `Created reminder for "${reminder.task}" scheduled ${reminder.targetTimeString}.`,
        data: reminder,
        actionDetails: {
          type: 'reminder',
          label: `Reminder: ${reminder.task} (${reminder.targetTimeString})`,
        },
      };
    }

    case 'manageNote': {
      const action = String(args.action || 'create').toLowerCase();
      if (action === 'create') {
        const title = String(args.title || 'Note');
        const content = String(args.content || args.text || '');
        const note = notesService.createNote(title, content);
        return {
          success: true,
          toolName: 'manageNote',
          message: `Saved note "${note.title}".`,
          data: note,
          actionDetails: {
            type: 'note',
            label: `Saved Note: ${note.title}`,
          },
        };
      } else if (action === 'read' || action === 'list') {
        const query = args.title ? String(args.title) : undefined;
        const notes = notesService.searchNotes(query);
        const summary = notes.length > 0
          ? notes.map(n => `• ${n.title}: ${n.content}`).join('\n')
          : 'No notes found.';
        return {
          success: true,
          toolName: 'manageNote',
          message: summary,
          data: notes,
        };
      } else {
        return {
          success: false,
          toolName: 'manageNote',
          message: `Unsupported note action: ${action}`,
        };
      }
    }

    case 'saveMemory': {
      const key = String(args.key || 'User preference').trim();
      const value = String(args.value || '').trim();
      if (!value) {
        return {
          success: false,
          toolName: 'saveMemory',
          message: 'No memory value provided to remember.',
        };
      }
      const mem = memoryService.saveMemory(key, value);
      return {
        success: true,
        toolName: 'saveMemory',
        message: `Remembered: ${mem.key} = ${mem.value}`,
        data: mem,
        actionDetails: {
          type: 'memory',
          label: `Remembered: ${mem.value}`,
        },
      };
    }

    case 'getMemory': {
      const query = args.query ? String(args.query) : undefined;
      const memories = memoryService.searchMemories(query);
      if (memories.length === 0) {
        return {
          success: true,
          toolName: 'getMemory',
          message: 'I do not have any stored memories about this yet.',
          data: [],
        };
      }
      const list = memories.map(m => `${m.key}: ${m.value}`).join('; ');
      return {
        success: true,
        toolName: 'getMemory',
        message: `Stored memory: ${list}`,
        data: memories,
      };
    }

    case 'searchWeb': {
      const query = String(args.query || '').trim();
      if (!query) {
        return {
          success: false,
          toolName: 'searchWeb',
          message: 'Search query cannot be empty.',
        };
      }

      try {
        // Query server-side search or Wikipedia instant summary
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`);
        if (res.ok) {
          const json = await res.json();
          if (json.extract) {
            return {
              success: true,
              toolName: 'searchWeb',
              message: json.extract,
              data: { title: json.title, extract: json.extract, url: json.content_urls?.desktop?.page },
              actionDetails: {
                type: 'search',
                label: `Search result for "${query}"`,
              },
            };
          }
        }

        // Fallback info
        return {
          success: true,
          toolName: 'searchWeb',
          message: `Searched information for "${query}".`,
          data: { query },
        };
      } catch (err) {
        return {
          success: false,
          toolName: 'searchWeb',
          message: `Web search error: ${String(err)}`,
        };
      }
    }

    default:
      return {
        success: false,
        toolName: name,
        message: `Unknown tool '${name}' requested.`,
      };
  }
}
