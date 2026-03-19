import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';
import { Button } from './button';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardContent className="pt-6">
        <p>Simple card with content only.</p>
      </CardContent>
    </Card>
  ),
};

export const WithHeaderContentFooter: Story = {
  render: () => (
    <Card className="w-[350px]">
      <CardHeader>
        <CardTitle>Revenue Report</CardTitle>
        <CardDescription>Monthly overview for March 2026</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">$45,231.89</p>
        <p className="text-sm text-gray-500">+20.1% from last month</p>
      </CardContent>
      <CardFooter className="justify-between">
        <Button variant="outline">Details</Button>
        <Button>Export</Button>
      </CardFooter>
    </Card>
  ),
};
