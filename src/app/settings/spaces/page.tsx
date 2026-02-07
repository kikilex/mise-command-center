'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Divider,
} from "@heroui/react"
import { Building, ArrowRight } from 'lucide-react'
import Navbar from '@/components/Navbar'
import SettingsNav from '@/components/SettingsNav'
import { useSpace } from '@/lib/space-context'

export default function SpacesSettingsPage() {
  const router = useRouter()
  const { selectedSpace } = useSpace()

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Settings Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="sticky top-24">
              <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>
              <SettingsNav />
            </div>
          </div>

          {/* Settings Content */}
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">Spaces Management</h2>
                <p className="text-default-500 mt-1">
                  Manage your organizational units
                </p>
              </div>
            </div>

            <Card>
              <CardBody className="py-12 text-center">
                <Building className="w-12 h-12 mx-auto text-default-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Manage Your Spaces</h3>
                <p className="text-default-500 mb-8 max-w-md mx-auto">
                  To create, edit, or delete spaces, use the primary Spaces dashboard. 
                  This is where you can see all your available contexts and manage their settings.
                </p>
                <Button 
                  color="primary" 
                  onPress={() => router.push('/spaces')}
                  endContent={<ArrowRight className="w-4 h-4" />}
                >
                  Go to Spaces Dashboard
                </Button>
              </CardBody>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
