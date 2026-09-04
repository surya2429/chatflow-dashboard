import ClienteleMarquee from '../components/ClienteleMarquee'

const ROW_1 = ['/logos/clientele-row1-a.png', '/logos/clientele-row1-b.png']
const ROW_2 = ['/logos/clientele-row2-a.png', '/logos/clientele-row2-b.png']

export default function Clientele() {
  return (
    <div className="py-14 bg-white">
      <div className="text-center max-w-xl mx-auto mb-10 px-4">
        <span className="badge-blue mb-3">Our Clientele</span>
        <h2 className="text-2xl font-bold text-slate-900 mt-3">
          Trusted by 500+ brands across industries
        </h2>
        <p className="section-sub mt-2">
          From schools to hospitals, real estate to logistics — teams of every size run on our platform.
        </p>
      </div>

      <div className="space-y-5">
        <ClienteleMarquee images={ROW_2} direction="left" />
        <ClienteleMarquee images={ROW_1} direction="right" />
      </div>
    </div>
  )
}
