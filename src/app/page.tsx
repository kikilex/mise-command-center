'use client'

import { 
  Button, 
  Card, 
  CardBody, 
  CardHeader,
  Chip,
  Divider,
  Switch
} from "@heroui/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Mise Command Center</h1>
          <p className="text-default-500">Life OS for the Mise family</p>
        </div>
        <div className="flex items-center gap-4">
          <Switch
            isSelected={theme === "dark"}
            onValueChange={(checked) => setTheme(checked ? "dark" : "light")}
            size="lg"
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </Switch>
          <Button color="primary">+ New Task</Button>
        </div>
      </header>

      <Divider className="my-6" />

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Today's Focus */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader className="flex gap-3">
            <div className="flex flex-col">
              <p className="text-xl font-semibold">Today&apos;s Focus</p>
              <p className="text-small text-default-500">January 28, 2026</p>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-default-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <Chip color="danger" size="sm" variant="flat">High</Chip>
                  <span>Set up Command Center infrastructure</span>
                </div>
                <Chip color="primary" size="sm">In Progress</Chip>
              </div>
              <div className="flex items-center justify-between p-3 bg-default-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <Chip color="warning" size="sm" variant="flat">Medium</Chip>
                  <span>Review testimony scripts</span>
                </div>
                <Chip color="default" size="sm">Todo</Chip>
              </div>
              <div className="flex items-center justify-between p-3 bg-default-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <Chip color="success" size="sm" variant="flat">Low</Chip>
                  <span>Plan content calendar for next week</span>
                </div>
                <Chip color="default" size="sm">Todo</Chip>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* AI Status */}
        <Card>
          <CardHeader>
            <p className="text-xl font-semibold">⚡ AI Status</p>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-success rounded-full animate-pulse"></div>
                <div>
                  <p className="font-medium">Ax (Umbrella CEO)</p>
                  <p className="text-small text-default-500">Online - Claude Opus</p>
                </div>
              </div>
              <Divider />
              <div className="text-small text-default-500">
                <p>Tasks completed today: <span className="text-foreground font-medium">3</span></p>
                <p>Currently working on: <span className="text-foreground font-medium">Command Center setup</span></p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <p className="text-xl font-semibold">📊 Quick Stats</p>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-default-100 rounded-lg">
                <p className="text-2xl font-bold text-primary">12</p>
                <p className="text-small text-default-500">Tasks This Week</p>
              </div>
              <div className="text-center p-3 bg-default-100 rounded-lg">
                <p className="text-2xl font-bold text-success">8</p>
                <p className="text-small text-default-500">Completed</p>
              </div>
              <div className="text-center p-3 bg-default-100 rounded-lg">
                <p className="text-2xl font-bold text-warning">4</p>
                <p className="text-small text-default-500">In Progress</p>
              </div>
              <div className="text-center p-3 bg-default-100 rounded-lg">
                <p className="text-2xl font-bold text-danger">1</p>
                <p className="text-small text-default-500">Overdue</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Businesses */}
        <Card>
          <CardHeader>
            <p className="text-xl font-semibold">🏢 Businesses</p>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-default-100 rounded-lg">
                <div>
                  <p className="font-medium">Christian Content</p>
                  <p className="text-small text-default-500">5 active tasks</p>
                </div>
                <Chip color="primary" size="sm" variant="dot">Active</Chip>
              </div>
              <Button 
                variant="flat" 
                color="default" 
                className="w-full"
                startContent={<span>+</span>}
              >
                Add Business
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Content Pipeline */}
        <Card>
          <CardHeader>
            <p className="text-xl font-semibold">🎬 Content Pipeline</p>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-default-500">Ideas</span>
                <span className="font-medium">8</span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-500">In Script</span>
                <span className="font-medium">3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-500">Review</span>
                <span className="font-medium text-warning">2</span>
              </div>
              <div className="flex justify-between">
                <span className="text-default-500">Ready to Post</span>
                <span className="font-medium text-success">4</span>
              </div>
              <Divider className="my-2" />
              <Button color="primary" variant="flat" className="w-full">
                View Pipeline
              </Button>
            </div>
          </CardBody>
        </Card>

      </div>
    </div>
  );
}
