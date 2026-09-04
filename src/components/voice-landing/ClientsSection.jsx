import ClienteleMarquee from '../ClienteleMarquee'

const ROW_1 = ['/logos/clientele-row1-a.png', '/logos/clientele-row1-b.png']
const ROW_2 = ['/logos/clientele-row2-a.png', '/logos/clientele-row2-b.png']

export default function ClientsSection() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-10">
        <span className="badge-blue">Our Clients</span>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-3">Trusted by Leading Brands</h2>
      </div>
      <div className="space-y-5">
        <ClienteleMarquee images={ROW_2} direction="left" />
        <ClienteleMarquee images={ROW_1} direction="right" />
      </div>
    </section>
  )
}
