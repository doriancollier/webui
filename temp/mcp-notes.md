MCP general ( in chat)

- cannot see what was passed or returend

---

mcp**dorkos**get_server_info

- version is 0.0.0 , but this could just be on dev

---

get_session_count

- doesn't look in the current directory. It looks in the directory the server is running in

---

get_current_agent

- not looking in the current cwd

---

mesh_discover

- doesn't distinguish between already registerd and not registered. I'm not sure it should distinguish

---

pulse_list_schedules

- what's the difference between the enabled and status fields. For example, schedule id `01KKE8QHFGKEBRNNWGQ3BR2XVZ` has `enabled: false` and `status: active`. What's that mean?

---

Should we make all of these available via the CLI? If so, how? Should it be one CLI, or multiple?
