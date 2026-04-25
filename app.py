import gradio as gr
from ticket_env import TicketEnv
from agents import Arbiter, AgentRegistry

def solve_ticket(ticket_text):
    env = TicketEnv(multi_agent_mode=True)
    obs = env.reset(ticket_text=ticket_text)
    
    output = []
    output.append(f"🎫 TICKET: {obs['ticket_description']}")
    output.append(f"📂 CATEGORY: {obs.get('ticket_category', 'Unknown')} (Conf: {obs.get('category_confidence', 0.0):.2f})")
    output.append("-" * 40)
    
    arbiter = Arbiter(AgentRegistry())
    
    max_steps = 6
    for step in range(max_steps):
        decision, metadata = arbiter.decide(
            state=env.state(),
            ticket_text=obs['ticket_description'],
            category=env.ticket_category
        )
        
        obs, reward, done, info = env.step(decision)
        
        selected_agent = metadata.get("selected_agent", "Agent")
        action = info.get("action", "")
        
        output.append(f"Step {step+1}: [{selected_agent}] -> {action} | Reward: {reward}")
        
        if done:
            output.append(f"\n✅ OUTCOME: {info.get('outcome', 'Resolved')}")
            output.append(f"🏆 TOTAL REWARD: {info.get('cumulative_reward', 0)}")
            break
            
    return "\n".join(output)

app = gr.Interface(
    fn=solve_ticket,
    inputs=gr.Textbox(lines=5, placeholder="Describe the IT incident here...", label="Incident Ticket"),
    outputs=gr.Textbox(lines=20, label="Agent Execution Trace"),
    title="OpenOps-RL: Autonomous IT Incident Resolution",
    description="Multi-agent reinforcement learning environment for automated operations.",
    examples=[
        ["Production website returns 503 for all users."],
        ["Batch worker keeps getting killed and jobs are stuck."],
        ["App cannot connect to database in private subnet. timeout connecting to db.internal after 30s"]
    ]
)

if __name__ == "__main__":
    app.launch()
